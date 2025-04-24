'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resampleFloat32Array = resampleFloat32Array;

var _fractionalDelay = require('fractional-delay');

var _fractionalDelay2 = _interopRequireDefault(_fractionalDelay);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert an array, typed or not, to a Float32Array, with possible re-sampling.
 *
 * @param {Object} options
 * @param {Array} options.inputSamples input array
 * @param {Number} options.inputSampleRate in Hertz
 * @param {Number} [options.outputSampleRate=options.inputSampleRate]
 * @returns {Promise.<Float32Array|Error>}
 */
function resampleFloat32Array() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  var promise = new Promise(function (resolve, reject) {
    var inputSamples = options.inputSamples;
    var inputSampleRate = options.inputSampleRate;

    var inputDelay = typeof options.inputDelay !== 'undefined' ? options.inputDelay : 0;

    var outputSampleRate = typeof options.outputSampleRate !== 'undefined' ? options.outputSampleRate : inputSampleRate;

    if (inputSampleRate === outputSampleRate && inputDelay === 0) {
      resolve(new Float32Array(inputSamples));
    } else {
      try {
        var outputSamplesNb = Math.ceil(inputSamples.length * outputSampleRate / inputSampleRate);

        var context = new window.OfflineAudioContext(1, outputSamplesNb, outputSampleRate);

        var inputBuffer = context.createBuffer(1, inputSamples.length, inputSampleRate);

        // create fractional delay
        var maxDelay = 1.0;
        var fractionalDelay = new _fractionalDelay2.default(inputSampleRate, maxDelay);
        fractionalDelay.setDelay(inputDelay / inputSampleRate);

        // create input buffer after applying fractional delay
        inputBuffer.getChannelData(0).set(fractionalDelay.process(inputSamples));

        var source = context.createBufferSource();
        source.buffer = inputBuffer;
        source.connect(context.destination);

        source.start(); // will start with offline context

        context.oncomplete = function (event) {
          var outputSamples = event.renderedBuffer.getChannelData(0);
          resolve(outputSamples);
        };

        context.startRendering();
      } catch (error) {
        reject(new Error('Unable to re-sample Float32Array. ' + error.message));
      }
    }
  });

  return promise;
} /**
   * @fileOverview Audio utilities
   * @author Jean-Philippe.Lambert@ircam.fr
   * @copyright 2016 IRCAM, Paris, France
   * @license BSD-3-Clause
   */

exports.default = {
  resampleFloat32Array: resampleFloat32Array
};