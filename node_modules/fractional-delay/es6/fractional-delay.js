/**
 * @fileoverview Fractional delay library
 * @author Arnau Julià <Arnau.Julia@gmail.com>
 * @version 0.1.0
 */
/**
 * @class FractionalDelay
 * @public
 */
export default class FractionalDelay {
    /**
     * Mandatory initialization method.
     * @public
     * @param units:Hz sampleRate Sample Rate the apparatus operates on.
     * @param type:Float units:s min:0.0 default:1 optMaxDelayTime The maximum delay time.
     * @chainable
     */
    constructor(sampleRate, optMaxDelayTime) {
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
    setDelay(delayTime) {
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
    getDelay() {
        return this.delayTime;
    }

    /**
     * Process method, where the output is calculated.
     * @param inputBuffer Input Array
     * @public
     */
    process(inputBuffer) {
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
    updatePointers() {
        // It's a circular buffer, so, when it is at the last position, the pointer return to the first position

        // Update posWrite pointer
        if (this.posWrite === (this.buffer.length - 1)) {
            this.posWrite = 0;
        } else {
            this.posWrite = this.posWrite + 1;
        }

        // Update posRead pointer
        if (this.posRead === (this.buffer.length - 1)) {
            this.posRead = 0;
        } else {
            this.posRead = this.posRead + 1;
        }
    }

    /**
     * Update Thiran coefficient (1st order Thiran)
     * @private
     */
    updateThiranCoefficient() {
        // Update the coefficient: (1-D)/(1+D) where D is fractional delay
        this.a1 = (1 - this.fracDelay) / (1 + this.fracDelay);
    }

    /**
     * Update the pointer posRead value when the delay value is changed
     * @private
     */
    resample() {
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
    fractionalThiranProcess(inputBuffer) {
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
}
