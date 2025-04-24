# Load Sofa formatted HRTFs from server in NodeJS #

Load a Sofa formatted HRTFs set from either a local or distant server. Instant access to closest match HRTF IRs {left,right} as an [AudioBuffer](https://developer.mozilla.org/fr/docs/Web/API/AudioBuffer) object for any given position. First published as a subclass of the [binauralFIR] library.


## How to use ##

Add the library to your node project:
```bash
npm install Ircam-RnD/serveSofaHrir
```

and check the  ``./examples`` folder for implementation details. See [binauralFIR] for an example use-case.

## Documentation ##

You can consult the [API documentation] for the complete documentation.

### ServerDataBase ###

**The public server that hosts a database of individual [HRTF]s is available
for beta-testers only and will open to public in 2016.**

The `ServerDataBase` retrieves a catalogue from a [SOFA] server. From the
catalogue, it get URLs matching optional filters: data-base, sample-rate,
and any free pattern.

### HRTF dataset ###

You can use any [HRTF] data-set that follows the [SOFA] standard, in JSON
format, using finite impulse responses (FIR). Second-order sections (SOS)
are not supported, yet. See the [examples HRTF directory] for a few samples.

## Developers ##

The source code is in the [src directory], in [ES2015] standard. `npm run
compile` with [Babel] to the [dist directory]. Note that there is a
[.babelrc] file. `npm run bundle` runs the linters, the tests,
generates the documentation, and compiles the code.

Commit the source files to the branch `develop`, and update the version in
[package.json] if this is intended to be a release.

On the `master` branch, merge from the `develop` branch. Generate and
commit the documentation and the distribution files. Put a release tag that
corresponds to the version in [package.json].

On the `gh-pages` branch, merge from the `master` branch. Commit the
examples, and the extra files (audio and HRTF set files).

### Style ###

`npm run lint` to check that the code conforms with [.eslintrc] and
[.jscsrc] files. The rules derive from [AirBnB] with these
major points:
- [ES2015]
- no `'use strict'` globally (already there via babel)
- enforce curly braces (`if`, `for`, etc.)
- allow spaces and new lines, with fewer requirements: use them for clarity

### Test ###

For any function or method, there is at least a test. The hierarchy in the
[test directory] is the same as in the [src directory].

- `npm run test` for all automated tests
- `npm run test-listen` for supervised listening tests. The test files must
  end with `_listen.js`
- `npm run test-issues` for unsolved issues. The issues may depend on the
  host: operating system, user-agent, sound-device, sample-rate, etc. The
  test files must end with `_issues.js`. Once an issue is solved, the
  corresponding tests are added to the automated test set.
- `npm run test-browser` starts a server for running the tests in any browser.

Examples for specific testing, when developing or resolving an issue:
- `browserify test/geometry/test_coordinates.js -t babelify | tape-run` in a
  headless browser
- `browserify test/geometry/test_coordinates.js -t babelify | testling -u`
  for an URL to open in any browser

### Documentation ###

Document any public function and method with [JSDoc], and generate the HTML
pages with `npm run doc`. At this point, neither
[jsdoc](https://www.npmjs.com/package/jsdoc) nor
[esdoc](https://www.npmjs.com/package/esdoc) gives perfect
transcription. (See the [jsdoc.json] and [esdoc.json] files.)

## License

This module is released under the [BSD-3-Clause] license.

## Acknowledgments

This research was developed by both [Acoustic And Cognitive Spaces] and [Analysis of Musical Practices] IRCAM research teams. A previous version was part of the WAVE project, funded by ANR (French National Research Agency). The current version, supporting multiple sources and a listener, HRTFs SOFA format and the access to a HRTF server, is part of the [CoSiMa] project, funded by ANR.The HRTF server and efforts for standardization of the HRTF SOFA format ([AES69 standard]) benefited from the financial support of the [Bili] project (French funding program FUI).

[//]: # (Avoid relative links for use with https://github.com/README.md)
[//]: # (and http://cdn.rawgit.com/Ircam-RnD/binauralFIR/next-gh-pages/doc/index.html)

[//]: # (Use relative links after the release, and drop rawgit.com)
[//]: # (next-develop => develop)
[//]: # (next-master => master)
[//]: # (next-gh-pages => gh-pages)

[.babelrc]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/.babelrc
[.eslintrc]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/.eslintrc
[.jscsrc]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/.jscsrc
[Acoustic And Cognitive Spaces]: http://recherche.ircam.fr/equipes/salles/
[AirBnB]: https://github.com/airbnb/javascript/
[Analysis of Musical Practices]: http://apm.ircam.fr/
[API documentation directory]: https://github.com/Ircam-RnD/binauralFIR/tree/next-master/doc/
[API documentation]: http://cdn.rawgit.com/Ircam-RnD/binauralFIR/next-master/doc/index.html
[Babel]: https://babeljs.io/
[binauralFIR]: https://github.com/Ircam-RnD/binauralFIR
[BSD-3-Clause]: http://opensource.org/licenses/BSD-3-Clause
[CoSiMa]: http://cosima.ircam.fr/
[doc directory]:  https://github.com/Ircam-RnD/binauralFIR/tree/next-master/doc/
[dist directory]:  https://github.com/Ircam-RnD/binauralFIR/tree/next-master/dist/
[documentation]: #documentation
[ES2015]: https://babeljs.io/docs/learn-es2015/
[esdoc.json]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/esdoc.json
[examples directory]: https://github.com/Ircam-RnD/binauralFIR/tree/next-gh-pages/examples/
[examples HRTF directory]: https://github.com/Ircam-RnD/binauralFIR/tree/next-gh-pages/examples/hrtf/
[examples online]: http://cdn.rawgit.com/Ircam-RnD/binauralFIR/next-gh-pages/examples/index.html
[HRTF]: http://en.wikipedia.org/wiki/Head-related_transfer_function
[IIRFilterNode]: https://webaudio.github.io/web-audio-api/#idl-def-IIRFilterNode
[jsdoc.json]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/jsdoc.json
[JSDoc]: http://usejsdoc.org/
[package.json]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/package.json
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
[SOFA]: http://www.aes.org/publications/standards/search.cfm?docID=99
[src directory]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/src/
[src/geometry]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/src/geometry/
[T. Carpentier article]: http://wac.ircam.fr/pdf/demo/wac15_submission_16.pdf
[test directory]: https://github.com/Ircam-RnD/binauralFIR/tree/next-develop/test/
[Web Audio API]: https://webaudio.github.io/web-audio-api/
[AES69 standard]: http://www.aes.org/publications/standards/search.cfm?docID=99
[Bili]: http://www.bili-project.org/