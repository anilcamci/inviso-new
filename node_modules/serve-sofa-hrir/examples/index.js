console.log(serveSofaHrir);

var audioContext = new AudioContext();

var serverDataBase = new serveSofaHrir.ServerDataBase({serverUrl:'http://bili2.ircam.fr'});
console.log(serverDataBase);

var catalogLoaded = serverDataBase.loadCatalogue();
console.log(catalogLoaded);

var urls = generateHrtfList();
console.log(urls);

var hrtfSet = new serveSofaHrir.HrtfSet({ audioContext:audioContext, coordinateSystem:'sofaSpherical' });
console.log(hrtfSet);


var url = './hrtf/IRC_1037_C_HRIR_44100.sofa.json';

var conv = audioContext.createConvolver();

hrtfSet.load(url).then( () => {
  console.log('Set loaded:', url);

  var loader = new BufferLoader(audioContext, [
      "./sounds/breakbeat.wav"
  ], (buffers) => {

    var src = audioContext.createBufferSource();
    src.buffer = buffers[0];
    console.log(buffers);

    var gain = audioContext.createGain();
    gain.gain.value = 8.0;

    var position = [0,0,1];
    var audioBuffer = hrtfSet.nearestFir(position);
    conv.buffer = audioBuffer;

    // src.connect(audioContext.destination);
    src.connect(conv);
    conv.connect(gain);
    gain.connect(audioContext.destination);
    src.loop = true;
    src.start(0);

  });

  loader.load();

});

window.onload = () => {


var azimSlider = document.getElementById('azimSlider');
var elevSlider = document.getElementById('elevSlider');

function updateFir() {
  var posSph = [-azimSlider.value, elevSlider.value, 1];
  var posCart = [0,0,0];
  audioBuffer = hrtfSet.nearestFir(posSph);
  conv.buffer = audioBuffer;
}

azimSlider.addEventListener('input', (value) => {
  document.getElementById("azim").innerHTML = azimSlider.value;
  updateFir();
});

elevSlider.addEventListener('input', (value) => {
  document.getElementById("elev").innerHTML = elevSlider.value;
  updateFir();
});

}


function generateHrtfList() {

  catalogLoaded
    .then(function() {
      let urls = serverDataBase.getUrls({
        convention: 'HRIR', // partial matching
        dataBase: 'Listen', // mixed-case
        equalisation: 'compensated', // lower-case
        sampleRate: 44100, // number
        // freePattern: 1012, // number
      });

      return urls;
    })
    .catch(function(error) {
      console.error('Error accessing HRTF server. ' + error.message + '. ' + 'Local files only.');
      return undefined;
    })
    .then(function(urls) {
      console.log('Available HRIRs:', urls);
    });
}
