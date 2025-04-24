import * as THREE from 'three';
import 'whatwg-fetch';
const ambisonics = require('ambisonics');

import Config from '../../data/config';
import Helpers from '../../utils/helpers';
import Action from '../model/action';
import { createAudioMeter, volumeAudioProcess } from '../helpers/volume-meter';

let isAmbisonicsMode = false;
const soundObjects = [];

export default class SoundObject {
  constructor(main, copyObject = false) {
    this.stoRef = main.stoRef;
    this.dbRef = main.dbRef;
    this.type = 'SoundObject';
    this.posX = 0;
    this.posY = 0;
    this.posZ = 0;
    this.radius = Config.soundObject.defaultRadius;
    this.cones = [];
    this.coneSounds = new Object();
    this.prevOmniSphereSound = null;
    this.audio = main.audio;
    this.gui = main.gui;
    this.isMuted = main.isMuted;
    this.app = main;
    this.userSetPlay = this.app.isPlaying;
    this.main = main;
    this.finishUploadingSound = true;

    this.trajectory = null;
    this.trajectoryClock = Config.soundObject.defaultTrajectoryClock;
    this.movementSpeed = Config.soundObject.defaultMovementSpeed;
    this.movementDirection = Config.soundObject.defaultMovementDirection;
    this.movementIncrement = null;
    this.oldPosition = null;
    this.hasBeenMoved = false;
    this.lastPathPosition = new THREE.Vector3();

    this.isLiveInput = false;
    this.microphoneChannel = 1;
    this.liveInputIsMuted = false;
    this.oldLiveInputVolume = 1;
    this.oldFileInputVolume = 1;
    this.oldFilePlayStatus = true;
    this.oldFileName = null;
    this.oldSound = null;
    this.liveInputDeviceId = 'None';
    this.stream = null;
    this.analyserContext = null;
    this.meter = null;
    this.rafID = null;
    this.canvasWidth;
    this.canvasHeight;


    this.objConeCache = {};
    this.oldTrajectorySpeed = null;
    

    this.containerObject = new THREE.Object3D();

    var materialColor = this.userSetPlay ? 0xFFFFFF : 0x8F8F8F;
    const sphereGeometry = new THREE.SphereBufferGeometry(this.radius, 100, 100);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: materialColor,
      opacity: 0.8,
      transparent: true,
      premultipliedAlpha: true
    });
    this.omniSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.omniSphere.name = 'omniSphere';
    this.omniSphere.castShadow = true;
    this.omniSphere.sound = null;

    const raycastSphereGeometry = new THREE.SphereBufferGeometry(150, 100, 100);
    const raycastSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, visible: false });
    this.raycastSphere = new THREE.Mesh(raycastSphereGeometry, raycastSphereMaterial);
    this.raycastSphere.name = 'sphere';
    this.raycastSphere.position.copy(main.mouse);
    main.scene.add(this.raycastSphere);

    this.axisHelper = new THREE.AxesHelper(100);
    this.axisHelper.position.copy(main.mouse);
    main.scene.add(this.axisHelper);

    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0x888888,
      dashSize: 30,
      gapSize: 30,
    });

    // const lineGeometry = new THREE.Geometry();

    // lineGeometry.vertices.push(
    //   new THREE.Vector3(0, 0, -300),
    //   new THREE.Vector3(0, 0, 300),
    // );

    // lineGeometry.computeLineDistances();
    const points = []
    points.push(new THREE.Vector3(0, 0, -300));
    points.push(new THREE.Vector3(0, 0, 300));

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    this.altitudeHelper = new THREE.Line(lineGeometry, lineMaterial);
    this.altitudeHelper.computeLineDistances(); // added
    this.altitudeHelper.rotation.x = Math.PI / 2;
    main.scene.add(this.altitudeHelper);
    this.altitudeHelper.position.copy(main.mouse);

    this.containerObject.add(this.omniSphere);
    this.containerObject.position.copy(main.mouse);
    main.scene.add(this.containerObject);
    // TODO: update roomCode if going from individual mode to group mode
    this.roomCode = main.roomCode;
    if(this.roomCode != null){
      this.headKey = main.headKey.key;
      // Firebase tracking for newly created soundObjects
      if(copyObject){
        this.containerObject.name = copyObject;
      } else {
        let objectKey = this.dbRef.child('objects').push();
        this.containerObject.name = objectKey.key;
        objectKey.set({
          position: this.containerObject.position,
          type: this.type,
          sound: null,
          lastEdit: main.headKey.key
        });
      }
    }

  }

  updateFirebaseDetails(dbRef, stoRef, headKey, roomCode){
    this.headKey = headKey.key;
    this.stoRef = stoRef;
    this.dbRef = dbRef;
    this.roomCode = roomCode;
    // push to firebase with new details
    let objectKey = this.dbRef.child('objects').push();
    this.containerObject.name = objectKey.key;
    
    let playState = this.omniSphere.sound ? !this.omniSphere.sound.state.isAudioPaused : 
                    this.app.isPlaying ? null : false;
    objectKey.set({
      position: this.containerObject.position,
      type: this.type,
      sound: null,
      lastEdit: this.headKey,
      isPlaying: playState
    });

    // upload object's sound
    if(this.omniSphere.sound != null && this.file){
        this.uploadSoundToFirebase(this, this.containerObject.name, this.file);
    }

    // upload all of object's cones
    this.cones.forEach((c) => {
        this.dbRef.child('objects').child('cones').push();
        if(c.file){
            this.uploadSoundToFirebase(c, c.uuid, c.file);
        }
    });

    // upload object's trajectory
    if(this.trajectory){
        this.trajectory.updateFirebaseDetails(dbRef, stoRef, headKey, roomCode);
    }
  }

  createCone(sound, color = null) {
    sound.volume.gain.value = 1;
    sound.spread = 0.5;

    const coneWidth = sound.spread * 90;
    const coneHeight = sound.volume.gain.value * 50 + 50;

    const coneGeo = new THREE.CylinderGeometry(coneWidth, 0, coneHeight, 100, 1, true);
    const randGreen = color !== null ? color : Math.random();
    const randBlue = color !== null ? color : Math.random();
    //const coneColor = new THREE.Color(0.5, randGreen, randBlue);
    const coneColor = new THREE.Color();
    coneColor.setHSL(randGreen, randBlue, 0.8);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: coneColor,
      opacity: 0.8,
      transparent:true
    });

    coneGeo.translate(0, coneHeight / 2, 0);  
    coneGeo.rotateX(Math.PI / 2);
    coneMaterial.side = THREE.DoubleSide;

    const cone = new THREE.Mesh(coneGeo, coneMaterial);

    cone.randGreen = randGreen;
    cone.sound = sound;
    cone.sound.panner.coneInnerAngle = Math.atan(coneWidth / coneHeight) * (180 / Math.PI);
    cone.sound.panner.coneOuterAngle = cone.sound.panner.coneInnerAngle * 3;
    cone.sound.panner.coneOuterGain = 0.05;
    // cone.sound.volume.gain.value = Helpers.mapRange(coneHeight, 100, 150, 0.5, 2);

    cone.name = 'cone';
    cone.baseColor = coneColor;
    cone.hoverColor = function() {
      let c = this.baseColor.clone();
      c.offsetHSL(0,-0.05,0.1);
      return c;
    }

    cone.userSetPlay = this.app.isPlaying;

    var materialColor = cone.userSetPlay ? cone.baseColor.getHex() : 0x8F8F8F;
    cone.material.color.setHex(materialColor);

    sound.scriptNode.onaudioprocess = function() {
      let array =  new Uint8Array(sound.analyser.frequencyBinCount);
      sound.analyser.getByteFrequencyData(array);
      let values = 0;
      let length = array.length;
      for (let i = 0; i < length; i++) values += array[i];
      let average = values / length;
      cone.material.opacity = Helpers.mapRange(average, 50, 100, 0.65, 0.95);

      // Updates current time of playback for audio display
      if (cone.sound && !cone.sound.state.isAudioPaused && !cone.sound.state.isChangingAudioTime) {
        var currentTime = (Date.now() - cone.sound.state.startedAt) / 1000;
        currentTime = currentTime % Math.floor(cone.sound.state.duration);
        cone.sound.state.currentTime = currentTime;
      }
    }

    cone.long = 0;
    cone.lat = 0;
    

    this.cones.push(cone);
    this.containerObject.add(cone);
    this.setAudioPosition(cone);
    return cone;
  }

  linearInterpToSpherical(x, y, z) {
    let azimuth, elevation, radial_distance;
    azimuth = Math.atan2(z, x) * 180 / Math.PI;
    if (azimuth < 0) {
        azimuth += 360;
    }
    azimuth = 90 - azimuth;
    azimuth += 180;
    // Mapping y [-300, 300] to elevation [-90, 90]
    elevation = (y / 300) * 90;
    
    // Computing radial distance as a normalized distance
    let maxPossibleDistance = Math.sqrt(Math.pow(5000, 2) + Math.pow(3000, 2) + Math.pow(300, 2));
    radial_distance = Math.abs(1 - Math.sqrt(x*x + y*y + z*z) / maxPossibleDistance); // TODO this would need to be applied as an extra gain node
  
    return {
        azimuth: azimuth,
        elevation: elevation,
        radial_distance: radial_distance
    };
}

  setAudioPosition(object) {
    const o = new THREE.Vector3();
    object.updateMatrixWorld();
    o.setFromMatrixPosition(object.matrixWorld);
    if(object.sound){
      var position = this.linearInterpToSpherical(o.x, o.y, o.z);
      object.sound.panner.setPosition(o.x, o.y, o.z);
      if (object.sound && object.sound.encoder) {
        object.sound.encoder.azim = position.azimuth;
        object.sound.encoder.elev = position.elevation;
        object.sound.encoder.updateGains();
      }
    }

    if (object.name == 'cone') {
      const p = new THREE.Vector3();
      const q = new THREE.Vector3();
      const m = object.matrixWorld;

      const mx = m.elements[12];
      const my = m.elements[13];
      const mz = m.elements[14];

      const vec = new THREE.Vector3(0, 0, 1);

      m.elements[12] = m.elements[13] = m.elements[14] = 0;

      vec.applyMatrix4(m);
      vec.normalize();
      if(object.sound){
        object.sound.panner.setOrientation(vec.x, vec.y, vec.z);
        // fix clicking noticed in recent safari versions when updating cone orientation in panner node
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        if (isSafari) {
            // get the listener from theh audio context
            const audioContext = object.sound.panner.context;
            const listener = audioContext.listener;
            const offset = 0.0001;

            // get the listener's current positions
            const listenerX = listener.positionX.value;
            const listenerY = listener.positionY.value;
            const listenerZ = listener.positionZ.value;

            // apply extremely small random offsets
            const newX = listenerX + (Math.random() * 2 - 1) * offset;
            const newY = listenerY + (Math.random() * 2 - 1) * offset;
            const newZ = listenerZ + (Math.random() * 2 - 1) * offset;
            listener.setPosition(newX, newY, newZ);
        }
      }

      m.elements[12] = mx;
      m.elements[13] = my;
      m.elements[14] = mz;
    }
  }

  uploadSoundToFirebase(object, id, file){
    let tempDbRef = this.dbRef;
    let headKey = this.headKey;
    if(object.type == 'SoundObject'){
        object.isAddingSound = true;
        let self = this;
        // change path from soundObjects/id
        let upload = this.stoRef.child('soundObjects/'+ id +'/' + file.name).put(file);
        upload.on('state_changed', function(snapshot){
          var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        }, function(error){
          console.log('Problem uploading file');
        }, function(){
          console.log('File finished uploading, pushing status');
          tempDbRef.child('objects').child(id).update({
            sound: file.name,
            volume: object.omniSphere.sound.volume.gain.value,
            lastEdit: headKey,
            isPlaying: object.omniSphere.sound != null ? !object.omniSphere.sound.state.isAudioPaused : self.app.isPlaying
          });
          object.isAddingSound = false;
        });
    } else {
        let self = this;
        let upload = this.stoRef.child('soundObjects/' + this.containerObject.name + '/' +  id + '/' + file.name).put(file);
        let isConePlaying = !object.sound.state.isAudioPaused;
        this.finishUploadingSound = false;
        upload.on('state_changed', function(snapshot){
          var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        }, function(error){
          console.log('Problem uploading file');
        }, function(){
          tempDbRef.child('objects').child(self.containerObject.name).child('cones').child(id).update({
            type: "cone",
            parent: self.containerObject.name,
            uuid: id,
            sound: file.name,
            volume: object.sound.volume.gain.value,
            spread: object.sound.spread,
            longitude: object.long,
            latitude: object.lat,
            lastEdit: headKey,
            isPlaying: isConePlaying,
          });
          self.finishUploadingSound = true;
        });
    }

  }

  // get the stream from the microphone - there is a hard limit of 2 channels for the WAAPI, so selectedChannel can be channel 1 or 2
  // of the selected input device
  getMediaStream(stream, numChannels, deviceId, selectedChannel, object) {
    const context = this.audio.context;
    const mainMixer = context.createGain();
    var sound = {};
    const constraints = { 
        'video': false, 
        'audio': {
          'deviceId': deviceId,
          'echoCancellation': false
        }, 
    };
    // Initialize sound object
    sound.mainMixer = mainMixer;

    sound.analyser = context.createAnalyser();
    sound.analyser.smoothingTimeConstant = 0.5;
    sound.analyser.fftSize = 2048;

    sound.panner = context.createPanner();
    sound.panner.panningModel = 'HRTF';
    sound.panner.distanceModel = 'inverse';
    sound.panner.refDistance = 100;
    sound.volume = context.createGain();

    sound.state = {}
    sound.state.startedAt = Date.now();
    sound.state.pausedAt = 0;
    sound.state.currentTime = 0;
    sound.state.isAudioPaused = false;
    sound.state.isChangingAudioTime = false;
    sound.state.duration = 0;

    // Create AudioNode from stream
    sound.scriptNode = context.createScriptProcessor(2048, 1, 1);
    sound.scriptNode.connect(context.destination);

    // visualize the incoming audio stream in the omniSphere
    sound.scriptNode.onaudioprocess = () => {
      const array = new Uint8Array(sound.analyser.frequencyBinCount);
      sound.analyser.getByteFrequencyData(array);
      let values = 0;
      const length = array.length;
      for (let i = 0; i < length; i++) values += array[i];
      const average = values / length;
      object.omniSphere.material.opacity = Helpers.mapRange(average, 50, 100, 0.65, 0.95);
    };

    sound.source = context.createMediaStreamSource(stream);
    sound.source.connect(sound.analyser); // Ensure analyser is connected to the source
    sound.source.connect(sound.scriptNode);

    if(selectedChannel !== null){
        console.log("Multiple channels exist! Selected channel:", selectedChannel);
        const splitter = context.createChannelSplitter(numChannels);
        const merger = context.createChannelMerger(1); // merge into a single channel
        sound.source.connect(splitter); // 0 is L, 1 is R
        let gains = [];
        for(let i = 0; i < numChannels; ++i){
            let gain = context.createGain();
            if(i === selectedChannel - 1){
                gain.gain.value = 1.0;
            } else {
                gain.gain.value = 0.0;
            }
            gains.push(gain);
        }
        for(let i = 0; i < gains.length; ++i){
            splitter.connect(gains[i], i);
            gains[i].connect(merger, 0, 0);
        }

        merger.connect(sound.volume);
        sound.volume.connect(sound.panner);
        sound.panner.connect(mainMixer);
    } else {
        sound.panner.panningModel = 'equalpower';
        sound.source.connect(sound.volume);
        sound.volume.connect(sound.panner);
        sound.panner.connect(mainMixer);
    }

    mainMixer.connect(context.destination);
    mainMixer.gain.value = this.oldLiveInputVolume;
    stream.getAudioTracks()[0].applyConstraints(constraints);

    this.omniSphere.sound = sound;
    this.setAudioPosition(this.omniSphere);
}

  // stop taking in live input stream
  stopMediaStream() {
    if (this.stream) {
      this.isLiveInput = false;
      this.stream.getAudioTracks().forEach(function(track) {
        track.stop();
      });
      // store the live input volume so it can be reset to this if the user switches back to live mode
      this.oldLiveInputVolume = this.omniSphere.sound.volume.gain.value;
      this.omniSphere.sound = null;
    }
  }

  loadSound(file, audio, mute, object, soundIn = null, copy=false) {
    const context = audio.context;
    const mainMixer = context.createGain();
    let reader = new FileReader();
    var sound = {};

    console.log("loading ", file.name);
    // add metadata with name of uuid
    if(object != null && !copy && this.roomCode != null){
      let id = object.uuid;
      if(object.type == 'SoundObject'){
        id = object.containerObject.name;
        this.uploadSoundToFirebase(object, id, file);
      }
    }
    
    if (object) { // cones can be null at this point
      object.filename = file.name;
      object.file = file;
    }
    var temp = null;
    if(soundIn != null){
      temp = Object.assign(soundIn, temp);
    }
    let promise = new Promise(function(resolve, reject) {
      reader.onload = (ev) => {
        context.decodeAudioData(ev.target.result, function(decodedData) {
          if (object && object.type === 'SoundObject') {
            /* attach omnidirectional sound */
            object = object.omniSphere;
          }

          if (object && object.sound) {
            if (!object.sound.state.isAudioPaused) {
              object.sound.source.stop();
            }
            
            if(temp){
              var pausedTime = temp.state.pausedAt;
              var current = temp.state.currentTime;
            }
            // Failed to execute disconnect on this audio node (346)
            object.sound.source.disconnect(object.sound.scriptNode);
            object.sound.scriptNode.disconnect(context.destination);

            if(temp){
              object.sound.state.clear(temp.state);
            }
            else {
              object.sound.state.clear();
            }
          }

          sound.context = context;
          sound.audio = audio;
          sound.mainMixer = mainMixer;

          sound.analyser = context.createAnalyser();
          sound.analyser.smoothingTimeConstant = 0.5;
          sound.analyser.fftSize = 1024;

          sound.panner = context.createPanner();
          sound.panner.panningModel = 'equalpower';
          sound.panner.distanceModel = 'inverse';
          sound.panner.refDistance = 100;

          // default to binaural mode
          sound.volume = context.createGain();
          sound.volume.connect(sound.analyser);
          sound.volume.connect(sound.panner);
          sound.panner.connect(mainMixer);
          mainMixer.connect(audio.destination);
          mainMixer.gain.value = mute ? 0 : 1;
          soundObjects.push(sound);

          sound.state = {}
          sound.state.startedAt = Date.now();
          sound.state.pausedAt = 0;
          sound.state.currentTime = 0;
          sound.state.isAudioPaused = false;
          sound.state.isChangingAudioTime = false;
          sound.state.duration = 0;

          // restore state
          if(soundIn != null && temp){
            sound.state.pausedAt = pausedTime;
            sound.state.currentTime = current;
          }

          sound.state.clear = () => {
            sound.state.startedAt = sound.state.pausedAt = sound.state.currentTime = sound.state.duration = 0;
            sound.state.isAudioPaused = true;
          }

          sound.play = (resumeTime = 0) => {
              sound.scriptNode = context.createScriptProcessor(2048, 1, 1);
              sound.scriptNode.connect(context.destination);
              sound.source = context.createBufferSource();
              sound.source.loop = true;
              sound.source.connect(sound.scriptNode);
              sound.source.connect(sound.volume);
              sound.source.buffer = decodedData;

              sound.state.duration = sound.source.buffer.duration;
              sound.source.start(context.currentTime + 0.020, resumeTime);
          }

          if(soundIn != null){
            sound.state.startedAt = Date.now() - sound.state.pausedAt;
            sound.state.isAudioPaused = false;
            sound.play(sound.state.pausedAt / 1000);
          }
          else {
            sound.play(0);
          }

          if (object && object.name === 'omniSphere') {
            sound.scriptNode.onaudioprocess = () => {
              const array = new Uint8Array(sound.analyser.frequencyBinCount);
              sound.analyser.getByteFrequencyData(array);
              let values = 0;
              const length = array.length;
              for (let i = 0; i < length; i++) values += array[i];
              const average = values / length;
              object.material.opacity = Helpers.mapRange(average, 50, 100, 0.65, 0.95);

              // Updates current time of play for audio playback
              if (!sound.state.isAudioPaused && !sound.state.isChangingAudioTime) {
                var currentTime = (Date.now() - sound.state.startedAt) / 1000;
                currentTime = currentTime % sound.state.duration;
                sound.state.currentTime = currentTime;
              }

            };
          }

          resolve(sound);
        });
      };

      reader.readAsArrayBuffer(file);
    });
    console.log("finished sound loading");
    return promise;
}

  playSound(userToggled = false, following = false) {
    if (!this.isLiveInput && this.omniSphere.sound && this.omniSphere.sound.state) {
      this.omniSphere.sound.state.startedAt = Date.now() - this.omniSphere.sound.state.pausedAt;
      this.omniSphere.sound.state.isAudioPaused = false;

      this.omniSphere.sound.play(this.omniSphere.sound.state.pausedAt / 1000);

      this.omniSphere.material.color.setHex(0xFFFFFF);
      if(userToggled && this.roomCode != null){
        this.updatePlayStatus(true);
      }
    } else {
        this.omniSphere.material.color.setHex(0xFFFFFF);
    }
    this.oldFilePlayStatus = true;
  }

  playConeSound(cone, userToggled = false, following = false) {
    cone.sound.state.startedAt = Date.now() - cone.sound.state.pausedAt;
    cone.sound.state.isAudioPaused = false;

    cone.sound.play(cone.sound.state.pausedAt / 1000);
    
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
         if (isSafari) {
             // get the listener from the audio context
             const audioContext = cone.sound.panner.context;
             const listener = audioContext.listener;
             const offset = 0.0001;
 
             // get the listener's current positions
             const listenerX = listener.positionX.value;
             const listenerY = listener.positionY.value;
             const listenerZ = listener.positionZ.value;
 
             // apply extremely small random offsets
             const newX = listenerX + (Math.random() * 2 - 1) * offset;
             const newY = listenerY + (Math.random() * 2 - 1) * offset;
             const newZ = listenerZ + (Math.random() * 2 - 1) * offset;
             listener.setPosition(newX, newY, newZ);
         }

    if(userToggled && this.roomCode != null){
        this.updateConePlayStatus(true, following, cone.uuid);
    }

    cone.material.color.setHex(cone.baseColor.getHex());
  }

  stopSound(userToggled = false, following = false) {
    if (!this.isLiveInput && this.omniSphere.sound && this.omniSphere.sound.state) {
      this.omniSphere.sound.state.pausedAt = (Date.now() - this.omniSphere.sound.state.startedAt) % (this.omniSphere.sound.state.duration * 1000);
      this.omniSphere.sound.state.isAudioPaused = true;
      this.omniSphere.sound.source.stop();

      this.omniSphere.material.color.setHex(0x8F8F8F);
      if(userToggled && this.roomCode != null){
       this.updatePlayStatus(false);
     }
    } else {
        this.omniSphere.material.color.setHex(0x8F8F8F);
    }
    this.oldFilePlayStatus = false;
  }

  updatePlayStatus(status){
    let updates = {};
    updates['isPlaying'] = status;
    console.log("updating play status", this.headKey);
    updates['lastEdit'] = this.headKey;
    this.dbRef.child('objects').child(this.containerObject.name).update(updates);
  }

  updateConePlayStatus(status, following, id){
    let updates = {};
    updates['isPlaying'] = status;
    if(!following){
      updates['lastEdit'] = this.headKey;
    }
    this.dbRef.child('objects').child(this.containerObject.name).child('cones').child(id).update(updates);

  }

  stopConeSound(cone, userToggled = false, following = false) {
    cone.sound.state.pausedAt = (Date.now() - cone.sound.state.startedAt) % (cone.sound.state.duration * 1000);
    cone.sound.state.isAudioPaused = true;

    cone.material.color.setHex(0x8F8F8F);
    cone.sound.source.stop();
    // cone.filename = null;
    if(userToggled && this.roomCode != null){
        this.updateConePlayStatus(false, following, cone.uuid);
    }
  }

  isUnderMouse(ray) {
    return ray.intersectObject(this.containerObject, true).length > 0;
  }

  select(main) {
    this.nonScaledMouseOffsetY = main.nonScaledMouse.y;
  }

  move(main, isTrajectoryDragging) {
    let pointer;
    let updates = {}
    if (main.perspectiveView) {
      const posY = Helpers.mapRange(
        main.nonScaledMouse.y - this.nonScaledMouseOffsetY,
        -0.5,
        0.5,
        -200,
        200,
      );

      pointer = this.containerObject.position;
      if (pointer.y > -200 || pointer.y < 200) pointer.y += posY;

      // clamp
      pointer.y = Math.max(Math.min(pointer.y, 300), -300);

      this.nonScaledMouseOffsetY = main.nonScaledMouse.y;
    } else {
      pointer = main.mouse;
      pointer.y = this.containerObject.position.y;
    }

    if(this.trajectory){
      this.trajectory.move(pointer, main.nonScaledMouse, main.perspectiveView);
    }

    this.setPosition(pointer);
    // fix for dragging while on trajectory
    if(this.roomCode != null){
      updates["position"] = pointer;
      updates["lastEdit"] = this.app.headKey.key;
      this.dbRef.child('objects').child(this.containerObject.name).update(updates);
    }
  
    if(!isTrajectoryDragging){
      this.hasBeenMoved = true;
    }
  }

  setPosition(position) {
    this.containerObject.position.copy(position);
    this.axisHelper.position.copy(position);
    this.altitudeHelper.position.copy(position);
    this.altitudeHelper.position.y = 0;
    this.raycastSphere.position.copy(position);

    if (this.cones[0]) {
      for (const i in this.cones) {
        this.setAudioPosition(this.cones[i]);
      }
    }

    if (this.omniSphere.sound){
      this.setAudioPosition(this.omniSphere);
    }
  }

  updateSpeed(rawSpeed){
    if(this.roomCode != null){
      this.dbRef.child('objects').child(this.containerObject.name).update({
        speed: rawSpeed,
        lastEdit: this.headKey,
      });
    }
  }

  addToScene(scene, pos = false) {
    if(pos){
      this.setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
    }
    scene.add(this.containerObject);
    if(this.roomCode != null){
      this.dbRef.child('objects').child(this.containerObject.name).update({});
    }
    
  }

  setActive(main) {
    if (this.trajectory) {
      this.trajectory.setActive();
      this.trajectory.setMouseOffset(main.nonScaledMouse, main.mouse);
    }
  }

  setInactive() {
    if (this.trajectory) {
      this.trajectory.setInactive();
    }
  }

  changeRadius(changedVolume = false) {
    if (this.omniSphere.sound && this.omniSphere.sound.volume) {
      const r = 0.5 + 0.5*this.omniSphere.sound.volume.gain.value;
      this.omniSphere.scale.x = this.omniSphere.scale.y = this.omniSphere.scale.z = r;
    }
    else {
      this.omniSphere.scale.x = this.omniSphere.scale.y = this.omniSphere.scale.z = 1;
    }
    if(changedVolume && this.roomCode != null){
      this.dbRef.child('objects').child(this.containerObject.name).update({
        volume: this.omniSphere.sound.volume.gain.value
      });
    }
  }

  changeLength(cone) {
    const r = cone.sound.spread * 90;
    const l = cone.sound.volume.gain.value * 50 + 50;
    cone.sound.panner.coneInnerAngle = Math.atan( r / l) * (180 / Math.PI);
    cone.sound.panner.coneOuterAngle = cone.sound.panner.coneInnerAngle * 1.5;

    cone.geometry.dynamic = true;

    cone.geometry.dispose();
    cone.geometry = new THREE.CylinderGeometry(r, 0, l, 100, 1, true);
    cone.geometry.translate(0, l / 2, 0);
    cone.geometry.rotateX(Math.PI / 2);
    let point = new THREE.Vector3();

    // coneRotation = point - this.containerObject.position
    // returns unit coneRotation vector
    this.lonLatToVector3(cone.long, cone.lat, point);
    point.multiplyScalar(500);
    point.addVectors(point, this.containerObject.position);
    cone.lookAt(point);
  }

  changeWidth(cone) {
    const r = cone.sound.spread * 90;
    const l = cone.sound.volume.gain.value * 50 + 50;
    cone.sound.panner.coneInnerAngle = Math.atan( r / l) * (180 / Math.PI);
    cone.sound.panner.coneOuterAngle = cone.sound.panner.coneInnerAngle * 3;

    cone.geometry.dynamic = true;

    cone.geometry.dispose();
    cone.geometry = new THREE.CylinderGeometry(r, 0, l, 100, 1, true);
    cone.geometry.translate(0, l / 2, 0);
    cone.geometry.rotateX(Math.PI / 2);
    let point = new THREE.Vector3();

    // coneRotation = point - this.containerObject.position
    // returns unit coneRotation vector
    this.lonLatToVector3(cone.long, cone.lat, point);
    point.multiplyScalar(500);
    point.addVectors(point, this.containerObject.position);
    cone.lookAt(point);
  }

  // returns a unit vector of the 3d position
  lonLatToVector3(lng, lat, out) {
    // taken from https://gist.github.com/nicoptere/2f2571db4b454bb18cd9
    out = out || new THREE.Vector3();

    //flips the Y axis
    lat = Math.PI / 2 - lat;

    //distribute to sphere
    out.set(
                Math.sin( lat ) * Math.sin( lng ),
                Math.cos( lat ),
                Math.sin( lat ) * Math.cos( lng )
    );
    return out;
  }

  pointCone(cone, point) {
    const coneRotation = new THREE.Vector3();
    coneRotation.subVectors(point, this.containerObject.position);
    cone.lookAt(point);
    this.setAudioPosition(cone);

    const longlat = (function( vector3 ) {
        // taken from https://gist.github.com/nicoptere/2f2571db4b454bb18cd9
        vector3.normalize();

        //longitude = angle of the vector around the Y axis
        //-( ) : negate to flip the longitude (3d space specific )
        //- PI / 2 to face the Z axis
        var lng = -( Math.atan2( -vector3.z, -vector3.x ) ) - Math.PI / 2;

        //to bind between -PI / PI
        if( lng < - Math.PI )lng += Math.PI*2;

        //latitude : angle between the vector & the vector projected on the XZ plane on a unit sphere

        //project on the XZ plane
        var p = new THREE.Vector3( vector3.x, 0, vector3.z );
        //project on the unit sphere
        p.normalize();
        let dotProduct = Number(p.dot(vector3)).toFixed(10);
        //compute the angle ( both vectors are normalized, no division by the sum of lengths )
        var lat = Math.acos(dotProduct);

        //invert if Y is negative to ensure the latitude is between -PI/2 & PI / 2
        if( vector3.y < 0 ) lat *= -1;

        return [ lng,lat ];

      })( coneRotation );
    cone.long = longlat[0];
    cone.lat = longlat[1];
    return longlat;
  }

  // Needs to be refactored - also lives in guiwindow
  pointConeMagic(cone, lat, long) {
    // adapted from https://gist.github.com/nicoptere/2f2571db4b454bb18cd9

    const v = (function lonLatToVector3( lng, lat )
      {
      //flips the Y axis
      lat = Math.PI / 2 - lat;

      //distribute to sphere
      return new THREE.Vector3(
        Math.sin( lat ) * Math.sin( lng ),
        Math.cos( lat ),
        Math.sin( lat ) * Math.cos( lng )
      );

      })( long, lat );
    if (v.x === 0) { v.x = 0.0001; }
    const point = this.containerObject.position.clone().add(v);
    this.pointCone(cone, point);

  }

  applySoundToCone(cone, sound) {

    sound.scriptNode.onaudioprocess = function() {
      let array =  new Uint8Array(sound.analyser.frequencyBinCount);
      sound.analyser.getByteFrequencyData(array);
      let values = 0;
      let length = array.length;
      for (let i = 0; i < length; i++) values += array[i];
      let average = values / length;
      cone.material.opacity = Helpers.mapRange(average, 50, 100, 0.65, 0.95);
      
     // Updates current time of playback for audio display
      if (cone.sound && !cone.sound.state.isAudioPaused && !cone.sound.state.isChangingAudioTime) {
        var currentTime = (Date.now() - cone.sound.state.startedAt) / 1000;
        currentTime = currentTime % Math.floor(cone.sound.state.duration);
        cone.sound.state.currentTime = currentTime;
      }
    
    }
  
    sound.spread = cone.sound.spread;
    sound.panner.refDistance = cone.sound.panner.refDistance;
    sound.panner.distanceModel = cone.sound.panner.distanceModel;
    sound.panner.coneInnerAngle = cone.sound.panner.coneInnerAngle;
    sound.panner.coneOuterAngle = cone.sound.panner.coneOuterAngle;
    sound.panner.coneOuterGain = cone.sound.panner.coneOuterGain;
    sound.volume.gain.value = cone.sound.volume.gain.value;
    cone.sound = sound;

  }

  removeCone(cone) {
    const i = this.cones.indexOf(cone);
    // coneSounds are not removed as part of undo/redo restoration
    if (cone.sound && !cone.sound.state.isAudioPaused) {
      this.stopConeSound(cone);
    }
    cone.sound.source.disconnect(cone.sound.scriptNode);
    cone.sound.scriptNode.disconnect(this.audio.context.destination);
    
    var previousState = cone.sound.state;
    var savedState = new Object();
    var savedState = Object.assign(savedState, previousState);

    this.coneSounds[cone.uuid].state = savedState;
    cone.sound.state.clear();
    cone.sound = null;
    this.cones.splice(i, 1);
    this.containerObject.remove(cone);
    this.gui.removeCone(cone);
    if(this.cones.length - 1 >= 0){
      this.app.interactiveCone = this.cones[this.cones.length - 1];
    } else {
      this.app.interactiveCone = null;
    }
    if(this.roomCode != null){
      this.dbRef.child('objects').child(this.containerObject.name).child('cones').child(cone.uuid).remove();
    }
  }

  removeFromScene(scene) {
    scene.remove(this.containerObject, true);
    scene.remove(this.altitudeHelper, true);
    scene.remove(this.axisHelper, true);
    scene.remove(this.trajectory, true);

    for (const i in this.cones) {
      this.cones[i].sound.source.stop();
    }
    if (this.omniSphere.sound && this.omniSphere.sound.source) {
      this.stopSound();
      this.prevOmniSphereSound = new Object();
      this.prevOmniSphereSound = Object.assign(this.prevOmniSphereSound, this.omniSphere.sound);
    }
    if(this.roomCode != null){
        // can this remove sounds from storage
      this.stoRef.child('soundObjects').child(this.containerObject.name).listAll()
      .then((res) => {
        res.items.forEach((itemRef) => {
            console.log(itemRef.location._path)
        });
        res.prefixes.forEach((folderRef) => {
            console.log(folderRef)
        });
      })
      this.dbRef.child('objects').child(this.containerObject.name).remove();
    }
  }

  restoreToScene(scene) {
    scene.add(this.containerObject);
    scene.add(this.altitudeHelper);
    scene.add(this.axisHelper);
    if(this.trajectory){
      scene.add(this.trajectory);
    }

    for(const i in this.cones){
      this.loadSound(this.cones[i].file, this.audio, this.isMuted, this.cones[i]).then((sound) => {
        this.applySoundToCone(this.cones[i], sound);
        this.setAudioPosition(this.cones[i]);
        this.app.interactiveCone = this.cones[i];
      });
    }

    if(this.file){
      var materialColor = this.userSetPlay ? 0xFFFFFF : 0x8F8F8F;
      this.omniSphere.material.color.setHex(materialColor);

      this.loadSound(this.file, this.audio, this.app.isMuted, this, this.prevOmniSphereSound).then((sound) => {
        this.omniSphere.sound = sound;
        this.omniSphere.sound.name = this.prevOmniSphereSound.name;
        this.omniSphere.sound.volume.gain.value = this.prevOmniSphereSound.volume.gain.value;
        this.setAudioPosition(this.omniSphere);

        if (!this.userSetPlay) {
          this.stopSound();
        }
      });
    }

  }

  restoreConeToScene(cone, soundIn){
    soundIn.source.connect(soundIn.scriptNode);
    soundIn.scriptNode.connect(this.audio.context.destination);
    soundIn.source.connect(soundIn.volume);
    cone.sound = soundIn;

    var materialColor = cone.userSetPlay ? cone.baseColor.getHex() : 0x8F8F8F;
    cone.material.color.setHex(materialColor);
    
    this.cones.push(cone);
    this.loadSound(cone.file, this.audio, this.isMuted, cone, soundIn).then((sound) => {
      cone.sound = sound;
      cone.sound.spread = soundIn.spread;
      cone.sound.volume.gain.value = soundIn.volume.gain.value;

      this.changeLength(cone);
      this.changeWidth(cone);
      this.pointConeMagic(cone, cone.lat, cone.long);

      this.applySoundToCone(this.cones[this.cones.length - 1], sound);
      this.setAudioPosition(this.cones[this.cones.length - 1]);
      this.app.interactiveCone = this.cones[this.cones.length - 1];

      if (!cone.userSetPlay) {
        this.stopConeSound(cone);
      }

    });

    this.app.setActiveObject(this);
    this.containerObject.add(cone);
    this.gui.addCone(cone);
    this.gui.show(this);
  }

  copyObject(object, position) {
    this.containerObject.position.copy(position);
    this.altitudeHelper.position.copy(position);
    this.raycastSphere.position.copy(position);
    this.axisHelper.position.copy(position);

    // Copy sound object
    if (object.omniSphere.sound) {
      this.loadSound(object.file, this.audio, this.app.isMuted, this).then((sound) => {
        this.omniSphere.sound = sound;
        this.omniSphere.sound.name = object.omniSphere.sound.name;
        this.omniSphere.sound.volume.gain.value = object.omniSphere.sound.volume.gain.value;
        if (object.omniSphere.sound.state.isAudioPaused) {
          this.stopSound();
        }
        this.userSetPlay = object.userSetPlay;
        this.setAudioPosition(this.omniSphere);
      });
    }
    this.omniSphere.material.color.setHex(object.omniSphere.material.color.getHex());

    // Copy cones on sound object
    object.cones.forEach((c) => {
      let cone;
      if (c.file) {
        this.loadSound(c.file, this.audio, false).then((sound) => {
          cone = this.createCone(sound, c.color);
          cone.file = c.file;
          cone.filename = c.filename;
          cone.sound.volume.gain.value = c.sound.volume.gain.value;
          cone.sound.spread = c.sound.spread;
          if (c.sound.state.isAudioPaused) {
            this.stopConeSound(cone);
            cone.material.color.setHex(0x8F8F8F);
          }
          else {
            cone.material.color.setHex(cone.baseColor.getHex());
          }
          cone.userSetPlay = c.userSetPlay;
          cone.lat = c.lat;
          cone.long = c.long;
          this.changeLength(cone);
          this.changeWidth(cone);
          this.containerObject.add(cone);
          this.gui.addCone(cone);
          this.coneSounds[cone.uuid] = cone.sound;
          this.pointConeMagic(cone, c.lat, c.long);
          this.app.undoableActionStack.push(new Action(this, 'addCone'));
          this.app.undoableActionStack[this.app.undoableActionStack.length - 1].secondary = cone;
        });
      }
    });

    this.movementSpeed = object.movementSpeed;
  }

  copyOmnisphereSound(file, volume, init, isPlaying = true){
    this.loadSound(file, this.audio, this.app.isMuted, this, null, true).then((sound) => {
      this.omniSphere.sound = sound;
      this.omniSphere.sound.name = file.name
      this.omniSphere.sound.volume.gain.value = volume;
      this.setAudioPosition(this.omniSphere);
      this.changeRadius();
      if(!isPlaying || !this.app.isPlaying){
        this.stopSound();
        this.userSetPlay = false;
      } else {
        this.userSetPlay = true;
      }
      this.isAddingSound = false;

      // if(init && this.audio.context.state === "suspended"){
      //   this.audio.context.resume();
      // }
    });
  }

  copyConeSound(file, volume, lat, long, spread, uuid, isPlaying = true, doesExist = false){
    this.loadSound(file, this.audio, this.app.isMuted, this, null, true).then((sound) => {
        if(!doesExist){
            if(this.objConeCache[uuid]){
                volume = this.objConeCache[uuid].volume;
                spread = this.objConeCache[uuid].spread;
                lat = this.objConeCache[uuid].latitude;
                long = this.objConeCache[uuid].longitude;
                this.objConeCache[uuid] = {};
            }
            let numConesPrior = this.cones.length;
            let cone = this.createCone(sound, null);
            cone.file = file;
            cone.filename = file.name;
            cone.sound.volume.gain.value = volume
            cone.sound.spread = spread;
            if (!isPlaying || !this.app.isPlaying) {
            this.stopConeSound(cone);
            cone.material.color.setHex(0x8F8F8F);
            cone.userSetPlay = false;
            }
            else {
            cone.material.color.setHex(cone.baseColor.getHex());
            cone.userSetPlay = true;
            }
            cone.lat = lat;
            cone.long = long;
            this.changeLength(cone);
            this.changeWidth(cone);
            cone.uuid = uuid;
            console.log("adding cone to gui, 1002");
            let addButton = document.getElementById('add-cone');
            if (addButton) {
                console.log(addButton.style.position, addButton.style.top);
                if (this.app.isEditingObject) {
                    addButton.style.top = "167.5px";
                } else {
                    addButton.style.top = "228.51px";
                }
                // 5%
                addButton.firstChild.style.padding = '1.5% 8px';
            }
            this.gui.addCone(cone, false);
            if(numConesPrior == 0){
                this.app.interactiveCone = cone;
            }
            this.coneSounds[cone.uuid] = cone.sound;
            this.pointConeMagic(cone, lat, long);
      } else {
            let index = this.cones.findIndex(cone => cone.uuid == uuid);
            this.applySoundToCone(this.cones[index], sound);
            this.setAudioPosition(this.cones[index])
      }
    })
  }

  disconnectSound(){
    if (!this.omniSphere.sound.state.isAudioPaused) {
      this.omniSphere.sound.source.stop();
    }
    this.omniSphere.sound.source.disconnect(this.omniSphere.sound.scriptNode);
    this.omniSphere.sound.scriptNode.disconnect(this.audio.context.destination);
    this.omniSphere.sound.state.clear();

    var materialColor = this.app.isPlaying ? 0xFFFFFF : 0x8F8F8F;
    this.omniSphere.material.color.setHex(materialColor);
    this.omniSphere.material.opacity = 0.8;
    this.omniSphere.sound = null;
    this.changeRadius();
    this.filename = null;
  }
  pause() {
    this.isPaused = true;
  }
  unpause() {
    this.isPaused = false;
  }

  mute(main) {
    this.isMuted = true;
    this.checkMuteState(main);
  }
  unmute(main) {
    this.isMuted = false;
    this.checkMuteState(main);
  }

  turnVisible() {
    this.containerObject.visible = true;
    this.axisHelper.visible = true;
    this.altitudeHelper.visible = true;
  }

  turnInvisible() {
    this.containerObject.visible = false;
    this.axisHelper.visible = false;
    this.altitudeHelper.visible = false;
  }

  checkMuteState(main) {
    if (this.isMuted) {
      this.cones.forEach(cone => cone.sound.mainMixer.gain.value = 0);
      if (this.omniSphere.sound && this.omniSphere.sound.mainMixer) {
        this.omniSphere.sound.mainMixer.gain.value = 0;
      }
    }
    else {
      this.cones.forEach(cone => cone.sound.mainMixer.gain.value = 1);
      if (this.omniSphere.sound && this.omniSphere.sound.mainMixer) {
        this.omniSphere.sound.mainMixer.gain.value = 1;
      }
    }
  }

  checkPlayState(main) {
    if (main.isPlaying) { // play
      if (this.omniSphere.sound && this.omniSphere.sound.state.isAudioPaused) {
        this.playSound(true);
        this.userSetPlay = true;
      } 
    //   else {
    //     if(this.roomCode){
    //         this.updatePlayStatus(null)
    //     }
    //   }
      this.cones.forEach((cone) => {
        if (cone.sound.state.isAudioPaused) {
          this.playConeSound(cone, true);
          cone.userSetPlay = true;

        }
        cone.material.color.setHex(cone.baseColor.getHex());
      });

      this.omniSphere.material.color.setHex(0xFFFFFF);
    }
    else { // pause
      this.cones.forEach((cone) => {
        if (!cone.sound.state.isAudioPaused) {

            // this should also update firebase details with this user as the last editor
          this.stopConeSound(cone, true);
          cone.userSetPlay = false;
        }
        cone.material.color.setHex(0x8F8F8F);
      });
      if (this.omniSphere.sound && !this.omniSphere.sound.state.isAudioPaused) {
        this.stopSound(true);
        this.userSetPlay = false;
      } 
    //   else {
    //     if(this.roomCode){
    //         this.updatePlayStatus(false);
    //     }
    //   }
      this.omniSphere.material.color.setHex(0x8F8F8F);
      
    }    
  }

  toggleAppearance(main) {
    if (main.isPlaying) {
        if ( this.omniSphere.sound && this.omniSphere.sound.state.isAudioPaused ) {
          this.omniSphere.material.color.setHex(0x8F8F8F);
        }
        else {
          this.omniSphere.material.color.setHex(0xFFFFFF);
        }
        this.cones.forEach((cone) => {
          if ( cone.sound && cone.sound.state.isAudioPaused ) {
            cone.material.color.set(0x8F8F8F);
          }
          else {
            cone.material.color.setHex(cone.baseColor.getHex());
          }
        });
    } else {
        this.omniSphere.material.color.setHex(0x8F8F8F);
        this.cones.forEach((cone) => {
            cone.material.color.setHex(0x8F8F8F);
        });
    }
  }

  followTrajectory(play) {
    if (this.trajectory && !this.isPaused && !this.isMuted && play) {
      this.trajectoryClock -= this.movementDirection * this.movementIncrement;

      if (this.trajectoryClock >= 1) {
        if (this.trajectory.spline.closed) {
          this.trajectoryClock = 0;
        } else {
          this.movementDirection = -this.movementDirection;
          this.trajectoryClock = 1;
        }
      }

      if (this.trajectoryClock < 0) {
        if (this.trajectory.spline.closed) {
          this.trajectoryClock = 1;
        } else {
          this.movementDirection = -this.movementDirection;
          this.trajectoryClock = 0;
        }
      }

      let pointOnTrajectory = this.trajectory.spline.getPointAt(this.trajectoryClock);
      this.containerObject.position.copy(pointOnTrajectory);
      this.raycastSphere.position.copy(pointOnTrajectory);
      this.altitudeHelper.position.copy(pointOnTrajectory);
      this.axisHelper.position.copy(pointOnTrajectory);
      this.altitudeHelper.position.y = 0;

      if(this.trajectory == null && this.roomCode != null){
        this.dbRef.child('objects').child(this.containerObject.name).update({
          position: pointOnTrajectory,
          lastEdit: this.app.headKey.key
        });
      }

      if (this.cones[0]) {
        for (const i in this.cones) {
          this.setAudioPosition(this.cones[i]);
        }
      }
      if (this.omniSphere.sound) {
        this.setAudioPosition(this.omniSphere);
      }
    }
  }

  calculateMovementSpeed() {
    if (this.trajectory) {
      this.movementIncrement = this.movementSpeed / this.trajectory.spline.getLength(10);
    }
  }

  toJSON() {
    return JSON.stringify({
      filename: (this.omniSphere.sound && this.omniSphere.sound && this.omniSphere.sound.name) || null,
      volume: (this.omniSphere && this.omniSphere.sound && this.omniSphere.sound.volume.gain.value) || null,
      position: this.containerObject.position,
      movementSpeed: this.movementSpeed,
      trajectory: (this.trajectory && this.trajectory.points) || null,
      cones: this.cones.map((c) => {
        return {
          file: c.file,
          filename: c.filename,
          position: {
            lat: c.lat,
            long: c.long,
          },
          volume: c.sound.volume.gain.value,
          spread: c.sound.spread,
          color: c.randGreen,
        };
      }),
    });
  }

  fromJSON(json, importedData) {
    const object = JSON.parse(json);
    this.containerObject.position.copy(object.position);
    this.altitudeHelper.position.copy(object.position);
    this.raycastSphere.position.copy(object.position);
    this.axisHelper.position.copy(object.position);

    if (object.filename && object.volume) {
      const file = importedData[object.filename];
      if (file) {
        this.loadSound(file, this.audio, false, this).then((sound) => {
          this.omniSphere.sound = sound;
          this.omniSphere.sound.name = object.filename;
          this.omniSphere.sound.volume.gain.value = object.volume;
          this.setAudioPosition(this.omniSphere);
          window.dispatchEvent(new Event('resize')); // resize window after loading to ensure aspect ratio is preserved
        });
      }
    }

    object.cones.forEach((c) => {
      let cone;
      const file = importedData[c.filename];
      if (file) {
        this.loadSound(file, this.audio, false).then((sound) => {
          cone = this.createCone(sound, c.color);
          cone.file = file;
          cone.filename = c.filename;
          cone.sound.volume.gain.value = c.volume;
          cone.sound.spread = c.spread;
          cone.lat = c.position.lat;
          cone.long = c.position.long;
          this.changeLength(cone);
          this.changeWidth(cone);
          this.gui.addCone(cone);
          this.pointConeMagic(cone, c.position.lat, c.position.long);
          let self = this;
          if(this.roomCode){
            let upload = this.stoRef.child('soundObjects/' + this.containerObject.name + '/' + cone.uuid + '/' + c.filename).put(file);
            console.log("uploading cone sound");
            upload.on('state_changed', function(snapshot){
                var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            }, function(error){
                console.log('Problem uploading file');
            }, function(){
                self.dbRef.child('objects').child(self.containerObject.name).child('cones').child(cone.uuid).update({
                    type: "cone",
                    parent: self.containerObject.name,
                    uuid: cone.uuid,
                    sound: cone.filename,
                    volume: c.volume,
                    spread: c.spread,
                    longitude: cone.long,
                    latitude: cone.lat,
                    lastEdit: self.headKey,
                    isPlaying: !cone.sound.state.isAudioPaused,
                });
            });
          }
        });
      }
    });

    this.movementSpeed = object.movementSpeed;
    if(this.roomCode){
        let updates = {
            "position": object.position,
        }
        this.dbRef.child('objects').child(this.containerObject.name).update(updates);
  
    }
  }
}

// event handler for switching to ambisonics mode
document.getElementById('binauralMode').addEventListener('click', function() {
  const newMode = !isAmbisonicsMode;
  if (setAmbisonicsMode(newMode)) {
    isAmbisonicsMode = newMode; 
    this.textContent = isAmbisonicsMode ? 'Ambisonics' : 'Binaural';
    this.style.color = isAmbisonicsMode ? 'rgb(251,21,97)' : '#5d5e5d';
  }
});

function setAmbisonicsMode(isAmbisonicsMode) {
  if (isAmbisonicsMode) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const outputChannels = audioContext.destination.maxChannelCount;

    if (outputChannels < 16) {
      showAmbisonicsModal('Ambisonics mode is not available unless an audio output device with 16 or more channels is connected.');
      return false;
    }
    else {
      // more than 16-channel output found; close the existing audio context before switching to ambisonics mode
      audioContext.close();
    }
  }

  soundObjects.forEach(sound => {
    // disconnect existing connections
    sound.volume.disconnect();
    sound.panner.disconnect();
    sound.mainMixer.disconnect();

    if (isAmbisonicsMode) {
      // switch to ambisonics mode
      sound.encoder = new ambisonics.monoEncoder(sound.context, 3);
      sound.volume.connect(sound.analyser);
      sound.volume.connect(sound.panner);
      sound.panner.connect(sound.encoder.in);
      sound.encoder.out.connect(sound.mainMixer);
      sound.mainMixer.connect(sound.audio.destination);
    } else {
      // switch back to binaural mode
      sound.volume.connect(sound.analyser);
      sound.volume.connect(sound.panner);
      sound.panner.connect(sound.mainMixer);
      sound.mainMixer.connect(sound.audio.destination);
    }
  });
  return true;
}

function showAmbisonicsModal(message) {
  const modal = document.getElementById('ambisonics_modal');
  const modalMessage = document.getElementById('modal-message');
  const modalClose = document.getElementById('modal-close');

  modalMessage.textContent = message;
  modal.style.display = 'flex';

  modalClose.onclick = () => {
    modal.style.display = 'none';
  };

  // close modal when clicking outside the modal content
  modal.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}