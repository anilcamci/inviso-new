(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.FractionalDelay = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @fileoverview Fractional delay library
 * @author Arnau Julià <Arnau.Julia@gmail.com>
 * @version 0.1.0
 */
/**
 * @class FractionalDelay
 * @public
 */
"use strict";

var _createClass = require("babel-runtime/helpers/create-class")["default"];

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

Object.defineProperty(exports, "__esModule", {
    value: true
});

var FractionalDelay = (function () {
    /**
     * Mandatory initialization method.
     * @public
     * @param units:Hz sampleRate Sample Rate the apparatus operates on.
     * @param type:Float units:s min:0.0 default:1 optMaxDelayTime The maximum delay time.
     * @chainable
     */

    function FractionalDelay(sampleRate, optMaxDelayTime) {
        _classCallCheck(this, FractionalDelay);

        // Properties with default values
        this.delayTime = 0;
        this.posRead = 0;
        this.posWrite = 0;
        this.fracXi1 = 0;
        this.fracYi1 = 0;
        this.intDelay = 0;
        this.fracDelay = 0;

        // Other properties
        this.a1 = undefined;

        // Save sample rate
        this.sampleRate = sampleRate;
        this.maxDelayTime = optMaxDelayTime || 1;

        this.bufferSize = this.maxDelayTime * this.sampleRate;
        // Check if the bufferSize is not an integer
        if (this.bufferSize % 1 !== 0) {
            this.bufferSize = parseInt(this.bufferSize) + 1;
        }
        // Create the internal buffer
        this.buffer = new Float32Array(this.bufferSize);
    }

    /**
     * Set delay value
     * @param delayTime Delay time
     * @public
     */

    _createClass(FractionalDelay, [{
        key: "setDelay",
        value: function setDelay(delayTime) {
            if (delayTime < this.maxDelayTime) {
                // Save delay value
                this.delayTime = delayTime;
                // Transform time in samples
                var samplesDelay = delayTime * this.sampleRate;
                // Get the integer part of samplesDelay
                this.intDelay = parseInt(samplesDelay);
                // Get the fractional part of samplesDelay
                this.fracDelay = samplesDelay - this.intDelay;
                // Update the value of the pointer
                this.resample();
                // If the delay has fractional part, update the Thiran Coefficients
                if (this.fracDelay !== 0) {
                    this.updateThiranCoefficient();
                }
            } else {
                throw new Error("delayTime > maxDelayTime");
            }
        }

        /**
         * Update delay value
         * @public
         */
    }, {
        key: "getDelay",
        value: function getDelay() {
            return this.delayTime;
        }

        /**
         * Process method, where the output is calculated.
         * @param inputBuffer Input Array
         * @public
         */
    }, {
        key: "process",
        value: function process(inputBuffer) {
            // Creates the outputBuffer, with the same length of the input
            var outputBuffer = new Float32Array(inputBuffer.length);

            // Integer delay process section
            for (var i = 0; i < inputBuffer.length; i = i + 1) {
                // Save the input value in the buffer
                this.buffer[this.posWrite] = inputBuffer[i];
                // Write the outputBuffer with the [inputValue - delay] sample
                outputBuffer[i] = this.buffer[this.posRead];
                // Update the value of posRead and posWrite pointers
                this.updatePointers();
            }
            // No fractional delay
            if (this.fracDelay === 0) {
                return outputBuffer;
            } else {
                // The fractional delay process section
                outputBuffer = new Float32Array(this.fractionalThiranProcess(outputBuffer));
                return outputBuffer;
            }
        }

        /**
         * Update the value of posRead and posWrite pointers inside the circular buffer
         * @private
         */
    }, {
        key: "updatePointers",
        value: function updatePointers() {
            // It's a circular buffer, so, when it is at the last position, the pointer return to the first position

            // Update posWrite pointer
            if (this.posWrite === this.buffer.length - 1) {
                this.posWrite = 0;
            } else {
                this.posWrite = this.posWrite + 1;
            }

            // Update posRead pointer
            if (this.posRead === this.buffer.length - 1) {
                this.posRead = 0;
            } else {
                this.posRead = this.posRead + 1;
            }
        }

        /**
         * Update Thiran coefficient (1st order Thiran)
         * @private
         */
    }, {
        key: "updateThiranCoefficient",
        value: function updateThiranCoefficient() {
            // Update the coefficient: (1-D)/(1+D) where D is fractional delay
            this.a1 = (1 - this.fracDelay) / (1 + this.fracDelay);
        }

        /**
         * Update the pointer posRead value when the delay value is changed
         * @private
         */
    }, {
        key: "resample",
        value: function resample() {
            if (this.posWrite - this.intDelay < 0) {
                var pos = this.intDelay - this.posWrite;
                this.posRead = this.buffer.length - pos;
            } else {
                this.posRead = this.posWrite - this.intDelay;
            }
        }

        /**
         * Fractional process method.
         * @private
         * @param inputBuffer Input Array
         */
    }, {
        key: "fractionalThiranProcess",
        value: function fractionalThiranProcess(inputBuffer) {
            var outputBuffer = new Float32Array(inputBuffer.length);

            var x, y;
            var xi1 = this.fracXi1;
            var yi1 = this.fracYi1;

            for (var i = 0; i < inputBuffer.length; i = i + 1) {
                // Current input sample
                x = inputBuffer[i];

                // Calculate the output
                y = this.a1 * x + xi1 - this.a1 * yi1;

                // Update the memories
                xi1 = x;
                yi1 = y;
                // Save the outputBuffer
                outputBuffer[i] = y;
            }
            // Save memories
            this.fracXi1 = xi1;
            this.fracYi1 = yi1;

            return outputBuffer;
        }
    }]);

    return FractionalDelay;
})();

exports["default"] = FractionalDelay;
module.exports = exports["default"];

},{"babel-runtime/helpers/class-call-check":4,"babel-runtime/helpers/create-class":5}],2:[function(require,module,exports){
module.exports = require('./dist/fractional-delay');

},{"./dist/fractional-delay":1}],3:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
},{"core-js/library/fn/object/define-property":6}],4:[function(require,module,exports){
"use strict";

exports["default"] = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

exports.__esModule = true;
},{}],5:[function(require,module,exports){
"use strict";

var _Object$defineProperty = require("babel-runtime/core-js/object/define-property")["default"];

exports["default"] = (function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;

      _Object$defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

exports.__esModule = true;
},{"babel-runtime/core-js/object/define-property":3}],6:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function defineProperty(it, key, desc){
  return $.setDesc(it, key, desc);
};
},{"../../modules/$":7}],7:[function(require,module,exports){
var $Object = Object;
module.exports = {
  create:     $Object.create,
  getProto:   $Object.getPrototypeOf,
  isEnum:     {}.propertyIsEnumerable,
  getDesc:    $Object.getOwnPropertyDescriptor,
  setDesc:    $Object.defineProperty,
  setDescs:   $Object.defineProperties,
  getKeys:    $Object.keys,
  getNames:   $Object.getOwnPropertyNames,
  getSymbols: $Object.getOwnPropertySymbols,
  each:       [].forEach
};
},{}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkaXN0L2VzNi9mcmFjdGlvbmFsLWRlbGF5LmpzIiwiZnJhY3Rpb25hbC1kZWxheS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2NvcmUtanMvb2JqZWN0L2RlZmluZS1wcm9wZXJ0eS5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2hlbHBlcnMvY2xhc3MtY2FsbC1jaGVjay5qcyIsIm5vZGVfbW9kdWxlcy9iYWJlbC1ydW50aW1lL2hlbHBlcnMvY3JlYXRlLWNsYXNzLmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9mbi9vYmplY3QvZGVmaW5lLXByb3BlcnR5LmpzIiwibm9kZV9tb2R1bGVzL2JhYmVsLXJ1bnRpbWUvbm9kZV9tb2R1bGVzL2NvcmUtanMvbGlicmFyeS9tb2R1bGVzLyQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lDU3FCLGVBQWU7Ozs7Ozs7OztBQVFyQixhQVJNLGVBQWUsQ0FRcEIsVUFBVSxFQUFFLGVBQWUsRUFBRTs4QkFSeEIsZUFBZTs7O0FBVTVCLFlBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLFlBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ2pCLFlBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLFlBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ2pCLFlBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ2pCLFlBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLFlBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDOzs7QUFHbkIsWUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUM7OztBQUdwQixZQUFJLENB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QUd0QyxtQkFBRyxHQUFHLENBQUMsQ0FBQztBQUNSLG1CQUFHLEdBQUcsQ0FBQyxDQUFDOztBQUVSLDRCQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBRXZCOztBQUVELGdCQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztBQUNuQixnQkFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUM7O0FBRW5CLG1CQUFPLFlBQVksQ0FBQztTQUN2Qjs7O1dBM0tnQixlQUFlOzs7cUJBQWYsZUFBZTs7OztBQ1RwQztBQUNBOztBQ0RBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogQGZpbGVvdmVydmlldyBGcmFjdGlvbmFsIGRlbGF5IGxpYnJhcnlcbiAqIEBhdXRob3IgQXJuYXUgSnVsacOgIDxBcm5hdS5KdWxpYUBnbWFpbC5jb20+XG4gKiBAdmVyc2lvbiAwLjEuMFxuICovXG4vKipcbiAqIEBjbGFzcyBGcmFjdGlvbmFsRGVsYXlcbiAqIEBwdWJsaWNcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRnJhY3Rpb25hbERlbGF5IHtcbiAgICAvKipcbiAgICAgKiBNYW5kYXRvcnkgaW5pdGlhbGl6YXRpb24gbWV0aG9kLlxuICAgICAqIEBwdWJsaWNcbiAgICAgKiBAcGFyYW0gdW5pdHM6SHogc2FtcGxlUmF0ZSBTYW1wbGUgUmF0ZSB0aGUgYXBwYXJhdHVzIG9wZXJhdGVzIG9uLlxuICAgICAqIEBwYXJhbSB0eXBlOkZsb2F0IHVuaXRzOnMgbWluOjAuMCBkZWZhdWx0OjEgb3B0TWF4RGVsYXlUaW1lIFRoZSBtYXhpbXVtIGRlbGF5IHRpbWUuXG4gICAgICogQGNoYWluYWJsZVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHNhbXBsZVJhdGUsIG9wdE1heERlbGF5VGltZSkge1xuICAgICAgICAvLyBQcm9wZXJ0aWVzIHdpdGggZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgdGhpcy5kZWxheVRpbWUgPSAwO1xuICAgICAgICB0aGlzLnBvc1JlYWQgPSAwO1xuICAgICAgICB0aGlzLnBvc1dyaXRlID0gMDtcbiAgICAgICAgdGhpcy5mcmFjWGkxID0gMDtcbiAgICAgICAgdGhpcy5mcmFjWWkxID0gMDtcbiAgICAgICAgdGhpcy5pbnREZWxheSA9IDA7XG4gICAgICAgIHRoaXMuZnJhY0RlbGF5ID0gMDtcblxuICAgICAgICAvLyBPdGhlciBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuYTEgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gU2F2ZSBzYW1wbGUgcmF0ZVxuICAgICAgICB0aGlzLnNhbXBsZVJhdGUgPSBzYW1wbGVSYXRlO1xuICAgICAgICB0aGlzLm1heERlbGF5VGltZSA9IG9wdE1heERlbGF5VGltZSB8fCAxO1xuXG4gICAgICAgIHRoaXMuYnVmZmVyU2l6ZSA9IHRoaXMubWF4RGVsYXlUaW1lICogdGhpcy5zYW1wbGVSYXRlO1xuICAgICAgICAvLyBDaGVjayBpZiB0aGUgYnVmZmVyU2l6ZSBpcyBub3QgYW4gaW50ZWdlclxuICAgICAgICBpZiAodGhpcy5idWZmZXJTaXplICUgMSAhPT0gMCkge1xuICAgICAgICAgICAgdGhpcy5idWZmZXJTaXplID0gcGFyc2VJbnQodGhpcy5idWZmZXJTaXplKSArIDE7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBpbnRlcm5hbCBidWZmZXJcbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuYnVmZmVyU2l6ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IGRlbGF5IHZhbHVlXG4gICAgICogQHBhcmFtIGRlbGF5VGltZSBEZWxheSB0aW1lXG4gICAgICogQHB1YmxpY1xuICAgICAqL1xuICAgIHNldERlbGF5KGRlbGF5VGltZSkge1xuICAgICAgICBpZiAoZGVsYXlUaW1lIDwgdGhpcy5tYXhEZWxheVRpbWUpIHtcbiAgICAgICAgICAgIC8vIFNhdmUgZGVsYXkgdmFsdWVcbiAgICAgICAgICAgIHRoaXMuZGVsYXlUaW1lID0gZGVsYXlUaW1lO1xuICAgICAgICAgICAgLy8gVHJhbnNmb3JtIHRpbWUgaW4gc2FtcGxlc1xuICAgICAgICAgICAgdmFyIHNhbXBsZXNEZWxheSA9IGRlbGF5VGltZSAqIHRoaXMuc2FtcGxlUmF0ZTtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgaW50ZWdlciBwYXJ0IG9mIHNhbXBsZXNEZWxheVxuICAgICAgICAgICAgdGhpcy5pbnREZWxheSA9IHBhcnNlSW50KHNhbXBsZXNEZWxheSk7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGZyYWN0aW9uYWwgcGFydCBvZiBzYW1wbGVzRGVsYXlcbiAgICAgICAgICAgIHRoaXMuZnJhY0RlbGF5ID0gc2FtcGxlc0RlbGF5IC0gdGhpcy5pbnREZWxheTtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgdmFsdWUgb2YgdGhlIHBvaW50ZXJcbiAgICAgICAgICAgIHRoaXMucmVzYW1wbGUoKTtcbiAgICAgICAgICAgIC8vIElmIHRoZSBkZWxheSBoYXMgZnJhY3Rpb25hbCBwYXJ0LCB1cGRhdGUgdGhlIFRoaXJhbiBDb2VmZmljaWVudHNcbiAgICAgICAgICAgIGlmICh0aGlzLmZyYWNEZWxheSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVGhpcmFuQ29lZmZpY2llbnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImRlbGF5VGltZSA+IG1heERlbGF5VGltZVwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBkZWxheSB2YWx1ZVxuICAgICAqIEBwdWJsaWNcbiAgICAgKi9cbiAgICBnZXREZWxheSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVsYXlUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgbWV0aG9kLCB3aGVyZSB0aGUgb3V0cHV0IGlzIGNhbGN1bGF0ZWQuXG4gICAgICogQHBhcmFtIGlucHV0QnVmZmVyIElucHV0IEFycmF5XG4gICAgICogQHB1YmxpY1xuICAgICAqL1xuICAgIHByb2Nlc3MoaW5wdXRCdWZmZXIpIHtcbiAgICAgICAgLy8gQ3JlYXRlcyB0aGUgb3V0cHV0QnVmZmVyLCB3aXRoIHRoZSBzYW1lIGxlbmd0aCBvZiB0aGUgaW5wdXRcbiAgICAgICAgdmFyIG91dHB1dEJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkoaW5wdXRCdWZmZXIubGVuZ3RoKTtcblxuICAgICAgICAvLyBJbnRlZ2VyIGRlbGF5IHByb2Nlc3Mgc2VjdGlvblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGlucHV0QnVmZmVyLmxlbmd0aDsgaSA9IGkgKyAxKSB7XG4gICAgICAgICAgICAvLyBTYXZlIHRoZSBpbnB1dCB2YWx1ZSBpbiB0aGUgYnVmZmVyXG4gICAgICAgICAgICB0aGlzLmJ1ZmZlclt0aGlzLnBvc1dyaXRlXSA9IGlucHV0QnVmZmVyW2ldO1xuICAgICAgICAgICAgLy8gV3JpdGUgdGhlIG91dHB1dEJ1ZmZlciB3aXRoIHRoZSBbaW5wdXRWYWx1ZSAtIGRlbGF5XSBzYW1wbGVcbiAgICAgICAgICAgIG91dHB1dEJ1ZmZlcltpXSA9IHRoaXMuYnVmZmVyW3RoaXMucG9zUmVhZF07XG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIHZhbHVlIG9mIHBvc1JlYWQgYW5kIHBvc1dyaXRlIHBvaW50ZXJzXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVBvaW50ZXJzKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm8gZnJhY3Rpb25hbCBkZWxheVxuICAgICAgICBpZiAodGhpcy5mcmFjRGVsYXkgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXRCdWZmZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaGUgZnJhY3Rpb25hbCBkZWxheSBwcm9jZXNzIHNlY3Rpb25cbiAgICAgICAgICAgIG91dHB1dEJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5mcmFjdGlvbmFsVGhpcmFuUHJvY2VzcyhvdXRwdXRCdWZmZXIpKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXRCdWZmZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIHZhbHVlIG9mIHBvc1JlYWQgYW5kIHBvc1dyaXRlIHBvaW50ZXJzIGluc2lkZSB0aGUgY2lyY3VsYXIgYnVmZmVyXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB1cGRhdGVQb2ludGVycygpIHtcbiAgICAgICAgLy8gSXQncyBhIGNpcmN1bGFyIGJ1ZmZlciwgc28sIHdoZW4gaXQgaXMgYXQgdGhlIGxhc3QgcG9zaXRpb24sIHRoZSBwb2ludGVyIHJldHVybiB0byB0aGUgZmlyc3QgcG9zaXRpb25cblxuICAgICAgICAvLyBVcGRhdGUgcG9zV3JpdGUgcG9pbnRlclxuICAgICAgICBpZiAodGhpcy5wb3NXcml0ZSA9PT0gKHRoaXMuYnVmZmVyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICB0aGlzLnBvc1dyaXRlID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucG9zV3JpdGUgPSB0aGlzLnBvc1dyaXRlICsgMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBwb3NSZWFkIHBvaW50ZXJcbiAgICAgICAgaWYgKHRoaXMucG9zUmVhZCA9PT0gKHRoaXMuYnVmZmVyLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICB0aGlzLnBvc1JlYWQgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wb3NSZWFkID0gdGhpcy5wb3NSZWFkICsgMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBUaGlyYW4gY29lZmZpY2llbnQgKDFzdCBvcmRlciBUaGlyYW4pXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB1cGRhdGVUaGlyYW5Db2VmZmljaWVudCgpIHtcbiAgICAgICAgLy8gVXBkYXRlIHRoZSBjb2VmZmljaWVudDogKDEtRCkvKDErRCkgd2hlcmUgRCBpcyBmcmFjdGlvbmFsIGRlbGF5XG4gICAgICAgIHRoaXMuYTEgPSAoMSAtIHRoaXMuZnJhY0RlbGF5KSAvICgxICsgdGhpcy5mcmFjRGVsYXkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgcG9pbnRlciBwb3NSZWFkIHZhbHVlIHdoZW4gdGhlIGRlbGF5IHZhbHVlIGlzIGNoYW5nZWRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlc2FtcGxlKCkge1xuICAgICAgICBpZiAodGhpcy5wb3NXcml0ZSAtIHRoaXMuaW50RGVsYXkgPCAwKSB7XG4gICAgICAgICAgICB2YXIgcG9zID0gdGhpcy5pbnREZWxheSAtIHRoaXMucG9zV3JpdGU7XG4gICAgICAgICAgICB0aGlzLnBvc1JlYWQgPSB0aGlzLmJ1ZmZlci5sZW5ndGggLSBwb3M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBvc1JlYWQgPSB0aGlzLnBvc1dyaXRlIC0gdGhpcy5pbnREZWxheTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyYWN0aW9uYWwgcHJvY2VzcyBtZXRob2QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0gaW5wdXRCdWZmZXIgSW5wdXQgQXJyYXlcbiAgICAgKi9cbiAgICBmcmFjdGlvbmFsVGhpcmFuUHJvY2VzcyhpbnB1dEJ1ZmZlcikge1xuICAgICAgICB2YXIgb3V0cHV0QnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheShpbnB1dEJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgICAgIHZhciB4LCB5O1xuICAgICAgICB2YXIgeGkxID0gdGhpcy5mcmFjWGkxO1xuICAgICAgICB2YXIgeWkxID0gdGhpcy5mcmFjWWkxO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5wdXRCdWZmZXIubGVuZ3RoOyBpID0gaSArIDEpIHtcbiAgICAgICAgICAgIC8vIEN1cnJlbnQgaW5wdXQgc2FtcGxlXG4gICAgICAgICAgICB4ID0gaW5wdXRCdWZmZXJbaV07XG5cbiAgICAgICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgb3V0cHV0XG4gICAgICAgICAgICB5ID0gdGhpcy5hMSAqIHggKyB4aTEgLSB0aGlzLmExICogeWkxO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdGhlIG1lbW9yaWVzXG4gICAgICAgICAgICB4aTEgPSB4O1xuICAgICAgICAgICAgeWkxID0geTtcbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIG91dHB1dEJ1ZmZlclxuICAgICAgICAgICAgb3V0cHV0QnVmZmVyW2ldID0geTtcblxuICAgICAgICB9XG4gICAgICAgIC8vIFNhdmUgbWVtb3JpZXNcbiAgICAgICAgdGhpcy5mcmFjWGkxID0geGkxO1xuICAgICAgICB0aGlzLmZyYWNZaTEgPSB5aTE7XG5cbiAgICAgICAgcmV0dXJuIG91dHB1dEJ1ZmZlcjtcbiAgICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGlzdC9mcmFjdGlvbmFsLWRlbGF5Jyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHsgXCJkZWZhdWx0XCI6IHJlcXVpcmUoXCJjb3JlLWpzL2xpYnJhcnkvZm4vb2JqZWN0L2RlZmluZS1wcm9wZXJ0eVwiKSwgX19lc01vZHVsZTogdHJ1ZSB9OyIsIlwidXNlIHN0cmljdFwiO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcbiAgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpO1xuICB9XG59O1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgX09iamVjdCRkZWZpbmVQcm9wZXJ0eSA9IHJlcXVpcmUoXCJiYWJlbC1ydW50aW1lL2NvcmUtanMvb2JqZWN0L2RlZmluZS1wcm9wZXJ0eVwiKVtcImRlZmF1bHRcIl07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTtcbiAgICAgIGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTtcbiAgICAgIGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTtcbiAgICAgIGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7XG5cbiAgICAgIF9PYmplY3QkZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHtcbiAgICBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuICAgIGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpO1xuICAgIHJldHVybiBDb25zdHJ1Y3RvcjtcbiAgfTtcbn0pKCk7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7IiwidmFyICQgPSByZXF1aXJlKCcuLi8uLi9tb2R1bGVzLyQnKTtcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVmaW5lUHJvcGVydHkoaXQsIGtleSwgZGVzYyl7XG4gIHJldHVybiAkLnNldERlc2MoaXQsIGtleSwgZGVzYyk7XG59OyIsInZhciAkT2JqZWN0ID0gT2JqZWN0O1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZTogICAgICRPYmplY3QuY3JlYXRlLFxuICBnZXRQcm90bzogICAkT2JqZWN0LmdldFByb3RvdHlwZU9mLFxuICBpc0VudW06ICAgICB7fS5wcm9wZXJ0eUlzRW51bWVyYWJsZSxcbiAgZ2V0RGVzYzogICAgJE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IsXG4gIHNldERlc2M6ICAgICRPYmplY3QuZGVmaW5lUHJvcGVydHksXG4gIHNldERlc2NzOiAgICRPYmplY3QuZGVmaW5lUHJvcGVydGllcyxcbiAgZ2V0S2V5czogICAgJE9iamVjdC5rZXlzLFxuICBnZXROYW1lczogICAkT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMsXG4gIGdldFN5bWJvbHM6ICRPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzLFxuICBlYWNoOiAgICAgICBbXS5mb3JFYWNoXG59OyJdfQ==
