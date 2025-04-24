# Fractional Delay library

> The Fractional Delay is a JavaScript library that implements a delay with a fractional delay.

This library implements a delay with a fractional delay approximation using a [first-order allpass interpolation](https://ccrma.stanford.edu/~jos/pasp/First_Order_Allpass_Interpolation.html), also called Thiran approximation.

```
               ____________________            ____________________
              |     M samples      |          |    ▲ fractional    |
y[n] -------> |   integer delay    | -------> |        delay       | -------> y[n - M - ▲]
              |____________________|          |____________________|


The M samples integer delay is implemented as a simple delay line: y[n] = x[n - M]
                                                                                           1 - ▲
The ▲ fractional delay is implemented as: y[n] = μ·x[n] + x[n - 1] - μ·y[n - 1] where μ = -------
                                                                                           1 + ▲

```


###Demo

A working demo for this module can be found [here](https://ircam-rnd.github.io/fractional-delay/) and in the `examples` folder.


### API

The `fractionalDelay` object exposes the following API:

Method | Description
--- | ---
`fractionalDelay.setDelay(delayTime)` | Set the delay time.
`fractionalDelay.getDelay()` | Get the delay time.
`fractionalDelay.process(inputBuffer)` | Process the data for an input buffer.

## License

This module is released under the [BSD-3-Clause license](http://opensource.org/licenses/BSD-3-Clause).

## Acknowledgments

This code has been developed from both [Acoustic And Cognitive Spaces](http://recherche.ircam.fr/equipes/salles/) and [Analysis of Musical Practices](http://apm.ircam.fr) IRCAM research teams. It is also part of the WAVE project (http://wave.ircam.fr), funded by ANR (The French National Research Agency), ContInt program, 2012-2015.
