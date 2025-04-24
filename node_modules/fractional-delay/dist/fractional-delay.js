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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImVzNi9mcmFjdGlvbmFsLWRlbGF5LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFTcUIsZUFBZTs7Ozs7Ozs7O0FBUXJCLGFBUk0sZUFBZSxDQVFwQixVQUFVLEVBQUUsZUFBZSxFQUFFOzhCQVJ4QixlQUFlOzs7QUFVNUIsWUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDbkIsWUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDakIsWUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDbEIsWUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDakIsWUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDakIsWUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDbEIsWUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7OztBQUduQixZQUFJLENBQUMsRUFBRSxHQUFHLFNBQVMsQ0FBQzs7O0FBR3BCLFlBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0FBQzdCLFlBQUksQ0FBQyxZQUFZLEdBQUcsZUFBZSxJQUFJLENBQUMsQ0FBQzs7QUFFekMsWUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7O0FBRXRELFlBQUksSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzNCLGdCQUFJLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ25EOztBQUVELFlBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ25EOzs7Ozs7OztpQkFoQ2dCLGVBQWU7O2VBdUN4QixrQkFBQyxTQUFTLEVBQUU7QUFDaEIsZ0JBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUU7O0FB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LElBQUksQ0FBQyxRQUFRLENBQUM7YUFDaEQ7U0FDSjs7Ozs7Ozs7O2VBT3NCLGlDQUFDLFdBQVcsRUFBRTtBQUNqQyxnQkFBSSxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDOztBQUV4RCxnQkFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ1QsZ0JBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDdkIsZ0JBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7O0FBRXZCLGlCQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTs7QUFFL0MsaUJBQUMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7OztBQUduQixpQkFBQyxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQzs7O0FBR3RDLG1CQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ1IsbUJBQUcsR0FBRyxDQUFDLENBQUM7O0FBRVIsNEJBQVksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7YUFFdkI7O0FBRUQsZ0JBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQ25CLGdCQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQzs7QUFFbkIsbUJBQU8sWUFBWSxDQUFDO1NBQ3ZCOzs7V0EzS2dCLGVBQWU7OztxQkFBZixlQUFlIiwiZmlsZSI6ImVzNi9mcmFjdGlvbmFsLWRlbGF5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IEZyYWN0aW9uYWwgZGVsYXkgbGlicmFyeVxuICogQGF1dGhvciBBcm5hdSBKdWxpw6AgPEFybmF1Lkp1bGlhQGdtYWlsLmNvbT5cbiAqIEB2ZXJzaW9uIDAuMS4wXG4gKi9cbi8qKlxuICogQGNsYXNzIEZyYWN0aW9uYWxEZWxheVxuICogQHB1YmxpY1xuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGcmFjdGlvbmFsRGVsYXkge1xuICAgIC8qKlxuICAgICAqIE1hbmRhdG9yeSBpbml0aWFsaXphdGlvbiBtZXRob2QuXG4gICAgICogQHB1YmxpY1xuICAgICAqIEBwYXJhbSB1bml0czpIeiBzYW1wbGVSYXRlIFNhbXBsZSBSYXRlIHRoZSBhcHBhcmF0dXMgb3BlcmF0ZXMgb24uXG4gICAgICogQHBhcmFtIHR5cGU6RmxvYXQgdW5pdHM6cyBtaW46MC4wIGRlZmF1bHQ6MSBvcHRNYXhEZWxheVRpbWUgVGhlIG1heGltdW0gZGVsYXkgdGltZS5cbiAgICAgKiBAY2hhaW5hYmxlXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc2FtcGxlUmF0ZSwgb3B0TWF4RGVsYXlUaW1lKSB7XG4gICAgICAgIC8vIFByb3BlcnRpZXMgd2l0aCBkZWZhdWx0IHZhbHVlc1xuICAgICAgICB0aGlzLmRlbGF5VGltZSA9IDA7XG4gICAgICAgIHRoaXMucG9zUmVhZCA9IDA7XG4gICAgICAgIHRoaXMucG9zV3JpdGUgPSAwO1xuICAgICAgICB0aGlzLmZyYWNYaTEgPSAwO1xuICAgICAgICB0aGlzLmZyYWNZaTEgPSAwO1xuICAgICAgICB0aGlzLmludERlbGF5ID0gMDtcbiAgICAgICAgdGhpcy5mcmFjRGVsYXkgPSAwO1xuXG4gICAgICAgIC8vIE90aGVyIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5hMSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBTYXZlIHNhbXBsZSByYXRlXG4gICAgICAgIHRoaXMuc2FtcGxlUmF0ZSA9IHNhbXBsZVJhdGU7XG4gICAgICAgIHRoaXMubWF4RGVsYXlUaW1lID0gb3B0TWF4RGVsYXlUaW1lIHx8IDE7XG5cbiAgICAgICAgdGhpcy5idWZmZXJTaXplID0gdGhpcy5tYXhEZWxheVRpbWUgKiB0aGlzLnNhbXBsZVJhdGU7XG4gICAgICAgIC8vIENoZWNrIGlmIHRoZSBidWZmZXJTaXplIGlzIG5vdCBhbiBpbnRlZ2VyXG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlclNpemUgJSAxICE9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZlclNpemUgPSBwYXJzZUludCh0aGlzLmJ1ZmZlclNpemUpICsgMTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDcmVhdGUgdGhlIGludGVybmFsIGJ1ZmZlclxuICAgICAgICB0aGlzLmJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5idWZmZXJTaXplKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgZGVsYXkgdmFsdWVcbiAgICAgKiBAcGFyYW0gZGVsYXlUaW1lIERlbGF5IHRpbWVcbiAgICAgKiBAcHVibGljXG4gICAgICovXG4gICAgc2V0RGVsYXkoZGVsYXlUaW1lKSB7XG4gICAgICAgIGlmIChkZWxheVRpbWUgPCB0aGlzLm1heERlbGF5VGltZSkge1xuICAgICAgICAgICAgLy8gU2F2ZSBkZWxheSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5kZWxheVRpbWUgPSBkZWxheVRpbWU7XG4gICAgICAgICAgICAvLyBUcmFuc2Zvcm0gdGltZSBpbiBzYW1wbGVzXG4gICAgICAgICAgICB2YXIgc2FtcGxlc0RlbGF5ID0gZGVsYXlUaW1lICogdGhpcy5zYW1wbGVSYXRlO1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBpbnRlZ2VyIHBhcnQgb2Ygc2FtcGxlc0RlbGF5XG4gICAgICAgICAgICB0aGlzLmludERlbGF5ID0gcGFyc2VJbnQoc2FtcGxlc0RlbGF5KTtcbiAgICAgICAgICAgIC8vIEdldCB0aGUgZnJhY3Rpb25hbCBwYXJ0IG9mIHNhbXBsZXNEZWxheVxuICAgICAgICAgICAgdGhpcy5mcmFjRGVsYXkgPSBzYW1wbGVzRGVsYXkgLSB0aGlzLmludERlbGF5O1xuICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSB2YWx1ZSBvZiB0aGUgcG9pbnRlclxuICAgICAgICAgICAgdGhpcy5yZXNhbXBsZSgpO1xuICAgICAgICAgICAgLy8gSWYgdGhlIGRlbGF5IGhhcyBmcmFjdGlvbmFsIHBhcnQsIHVwZGF0ZSB0aGUgVGhpcmFuIENvZWZmaWNpZW50c1xuICAgICAgICAgICAgaWYgKHRoaXMuZnJhY0RlbGF5ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUaGlyYW5Db2VmZmljaWVudCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZGVsYXlUaW1lID4gbWF4RGVsYXlUaW1lXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIGRlbGF5IHZhbHVlXG4gICAgICogQHB1YmxpY1xuICAgICAqL1xuICAgIGdldERlbGF5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kZWxheVRpbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyBtZXRob2QsIHdoZXJlIHRoZSBvdXRwdXQgaXMgY2FsY3VsYXRlZC5cbiAgICAgKiBAcGFyYW0gaW5wdXRCdWZmZXIgSW5wdXQgQXJyYXlcbiAgICAgKiBAcHVibGljXG4gICAgICovXG4gICAgcHJvY2VzcyhpbnB1dEJ1ZmZlcikge1xuICAgICAgICAvLyBDcmVhdGVzIHRoZSBvdXRwdXRCdWZmZXIsIHdpdGggdGhlIHNhbWUgbGVuZ3RoIG9mIHRoZSBpbnB1dFxuICAgICAgICB2YXIgb3V0cHV0QnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheShpbnB1dEJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgICAgIC8vIEludGVnZXIgZGVsYXkgcHJvY2VzcyBzZWN0aW9uXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgaW5wdXRCdWZmZXIubGVuZ3RoOyBpID0gaSArIDEpIHtcbiAgICAgICAgICAgIC8vIFNhdmUgdGhlIGlucHV0IHZhbHVlIGluIHRoZSBidWZmZXJcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyW3RoaXMucG9zV3JpdGVdID0gaW5wdXRCdWZmZXJbaV07XG4gICAgICAgICAgICAvLyBXcml0ZSB0aGUgb3V0cHV0QnVmZmVyIHdpdGggdGhlIFtpbnB1dFZhbHVlIC0gZGVsYXldIHNhbXBsZVxuICAgICAgICAgICAgb3V0cHV0QnVmZmVyW2ldID0gdGhpcy5idWZmZXJbdGhpcy5wb3NSZWFkXTtcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgdmFsdWUgb2YgcG9zUmVhZCBhbmQgcG9zV3JpdGUgcG9pbnRlcnNcbiAgICAgICAgICAgIHRoaXMudXBkYXRlUG9pbnRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBObyBmcmFjdGlvbmFsIGRlbGF5XG4gICAgICAgIGlmICh0aGlzLmZyYWNEZWxheSA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dEJ1ZmZlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZSBmcmFjdGlvbmFsIGRlbGF5IHByb2Nlc3Mgc2VjdGlvblxuICAgICAgICAgICAgb3V0cHV0QnVmZmVyID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLmZyYWN0aW9uYWxUaGlyYW5Qcm9jZXNzKG91dHB1dEJ1ZmZlcikpO1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dEJ1ZmZlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgdmFsdWUgb2YgcG9zUmVhZCBhbmQgcG9zV3JpdGUgcG9pbnRlcnMgaW5zaWRlIHRoZSBjaXJjdWxhciBidWZmZXJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHVwZGF0ZVBvaW50ZXJzKCkge1xuICAgICAgICAvLyBJdCdzIGEgY2lyY3VsYXIgYnVmZmVyLCBzbywgd2hlbiBpdCBpcyBhdCB0aGUgbGFzdCBwb3NpdGlvbiwgdGhlIHBvaW50ZXIgcmV0dXJuIHRvIHRoZSBmaXJzdCBwb3NpdGlvblxuXG4gICAgICAgIC8vIFVwZGF0ZSBwb3NXcml0ZSBwb2ludGVyXG4gICAgICAgIGlmICh0aGlzLnBvc1dyaXRlID09PSAodGhpcy5idWZmZXIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgIHRoaXMucG9zV3JpdGUgPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wb3NXcml0ZSA9IHRoaXMucG9zV3JpdGUgKyAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHBvc1JlYWQgcG9pbnRlclxuICAgICAgICBpZiAodGhpcy5wb3NSZWFkID09PSAodGhpcy5idWZmZXIubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgIHRoaXMucG9zUmVhZCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBvc1JlYWQgPSB0aGlzLnBvc1JlYWQgKyAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIFRoaXJhbiBjb2VmZmljaWVudCAoMXN0IG9yZGVyIFRoaXJhbilcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHVwZGF0ZVRoaXJhbkNvZWZmaWNpZW50KCkge1xuICAgICAgICAvLyBVcGRhdGUgdGhlIGNvZWZmaWNpZW50OiAoMS1EKS8oMStEKSB3aGVyZSBEIGlzIGZyYWN0aW9uYWwgZGVsYXlcbiAgICAgICAgdGhpcy5hMSA9ICgxIC0gdGhpcy5mcmFjRGVsYXkpIC8gKDEgKyB0aGlzLmZyYWNEZWxheSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBwb2ludGVyIHBvc1JlYWQgdmFsdWUgd2hlbiB0aGUgZGVsYXkgdmFsdWUgaXMgY2hhbmdlZFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgcmVzYW1wbGUoKSB7XG4gICAgICAgIGlmICh0aGlzLnBvc1dyaXRlIC0gdGhpcy5pbnREZWxheSA8IDApIHtcbiAgICAgICAgICAgIHZhciBwb3MgPSB0aGlzLmludERlbGF5IC0gdGhpcy5wb3NXcml0ZTtcbiAgICAgICAgICAgIHRoaXMucG9zUmVhZCA9IHRoaXMuYnVmZmVyLmxlbmd0aCAtIHBvcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucG9zUmVhZCA9IHRoaXMucG9zV3JpdGUgLSB0aGlzLmludERlbGF5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJhY3Rpb25hbCBwcm9jZXNzIG1ldGhvZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBwYXJhbSBpbnB1dEJ1ZmZlciBJbnB1dCBBcnJheVxuICAgICAqL1xuICAgIGZyYWN0aW9uYWxUaGlyYW5Qcm9jZXNzKGlucHV0QnVmZmVyKSB7XG4gICAgICAgIHZhciBvdXRwdXRCdWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KGlucHV0QnVmZmVyLmxlbmd0aCk7XG5cbiAgICAgICAgdmFyIHgsIHk7XG4gICAgICAgIHZhciB4aTEgPSB0aGlzLmZyYWNYaTE7XG4gICAgICAgIHZhciB5aTEgPSB0aGlzLmZyYWNZaTE7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbnB1dEJ1ZmZlci5sZW5ndGg7IGkgPSBpICsgMSkge1xuICAgICAgICAgICAgLy8gQ3VycmVudCBpbnB1dCBzYW1wbGVcbiAgICAgICAgICAgIHggPSBpbnB1dEJ1ZmZlcltpXTtcblxuICAgICAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBvdXRwdXRcbiAgICAgICAgICAgIHkgPSB0aGlzLmExICogeCArIHhpMSAtIHRoaXMuYTEgKiB5aTE7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbWVtb3JpZXNcbiAgICAgICAgICAgIHhpMSA9IHg7XG4gICAgICAgICAgICB5aTEgPSB5O1xuICAgICAgICAgICAgLy8gU2F2ZSB0aGUgb3V0cHV0QnVmZmVyXG4gICAgICAgICAgICBvdXRwdXRCdWZmZXJbaV0gPSB5O1xuXG4gICAgICAgIH1cbiAgICAgICAgLy8gU2F2ZSBtZW1vcmllc1xuICAgICAgICB0aGlzLmZyYWNYaTEgPSB4aTE7XG4gICAgICAgIHRoaXMuZnJhY1lpMSA9IHlpMTtcblxuICAgICAgICByZXR1cm4gb3V0cHV0QnVmZmVyO1xuICAgIH1cbn1cbiJdfQ==