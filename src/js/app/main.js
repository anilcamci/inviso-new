// latest version of three.js as of 07/20/2022: 0.142.0
// this app uses 0.87.1 of three.js
import * as THREE from 'three';
import TWEEN from 'tween.js';
import OBJLoader from './../utils/objloader';
import Helpers from './../utils/helpers';
import HeadObject from './components/headobject';
import SoundObject from './components/soundobject';
import SoundZone from './components/soundzone';

// Components
import Renderer from './components/renderer';
import Camera from './components/camera';
import Light from './components/light';
import Controls from './components/controls';
import PathDrawer from './components/pathdrawer';

// Helpers
import Geometry from './helpers/geometry';

// Model
import Model from './model/model';
import Action from './model/action';

// Managers
import Interaction from './managers/interaction';
import GUIWindow from './managers/guiwindow';
import SoundSearch from './managers/SoundSearch';

// data
import Config from './../data/config';

// Firebase
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/storage";

const ambisonics = require('ambisonics');

// Local vars for rStats
let rS, bS, glS, tS;
const TOLERANCE = 0.000001;

// This class instantiates and ties all of the components together
// starts the loading process and renders the main loop
export default class Main {
  constructor(container) {
    firebase.initializeApp(Config.firebaseConfig);
    // this.functions = firebase.functions();
    this.database = firebase.database();
    this.storage = firebase.storage();
    this.dbRef = this.database.ref();
    this.stoRef = this.storage.ref();
    this.inviteCode = null;
    OBJLoader(THREE);
    this.roomCode = null;
    this.overrideTriangulate();
    this.audioFiles = [];
    this.setupAudio();
    this.mouse = new THREE.Vector3();
    this.nonScaledMouse = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this.walkingRay = new THREE.Raycaster();

    this.isMuted = false;
    this.isPlaying = true;
    this.isMouseDown = false;
    this.isAddingTrajectory = false;
    this.isAddingObject = false;
    this.isEditingObject = false;
    this.isUserStudyLoading = false;
    this.isAllowMouseDrag = false;
    this.isAddingSound = false;
    this.trajectoryCache = {};

    this.activeObject = null;
    this.undoableActionStack = [];
    this.redoableActionStack = [];

    this.floor;
    this.counter = 1;
    this.movementSpeed = 10;
    this.increment = 0.01;
    this.direction = 1;

    this.soundObjects = [];
    this.soundTrajectories = [];
    this.soundZones = [];
    this.tempSoundTransfer;

    this.loader;
    this.moveForward = 0;
    this.moveBackwards = 0;
    this.yawLeft = 0;
    this.yawRight = 0;
    this.rotationSpeed = 0.05;

    this.perspectiveView = false;
    this.keyPressed = false;
    this.tooltipShow = true;
    this.movedHead = false;
    this.addObjectLabel = true;
    this.cameraHasLabel = true;

    this.interactiveCone = null;

    this.cameraDestination = new THREE.Vector3();

    this.ray.params.Line.threshold = 10;

    console.log("ray: ", this.ray);
    // Set container property to container element
    this.container = container;

    // Start Three clock
    this.clock = new THREE.Clock();

    // Main scene creation
    this.scene = new THREE.Scene();

    // Add GridHelper
    const grid = new THREE.GridHelper(Config.grid.size, Config.grid.divisions);
    grid.position.y = -300;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    this.scene.add(grid);


    /**
     * The X-Z raycasting plane for determining where on the floor
     * the user is clicking.
     */
    const planeGeometry = new THREE.PlaneGeometry(Config.grid.size*2, Config.grid.size*2);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      visible: false
    });
    this.floor = new THREE.Mesh(planeGeometry, planeMaterial);
    this.floor.rotation.x = Math.PI / 2;
    this.scene.add(this.floor);

    const shadowFloor = new THREE.Mesh(planeGeometry.clone(), new THREE.MeshLambertMaterial({
      color:0xf0f0f0,
      side:THREE.BackSide,
      transparent: true,
      opacity: 0.2
    }) );
    shadowFloor.rotation.x = Math.PI / 2;
    shadowFloor.position.y = -300;
    shadowFloor.receiveShadow = true;
    this.scene.add(shadowFloor);


    // Get Device Pixel Ratio first for retina
    if (window.devicePixelRatio) {
      Config.dpr = window.devicePixelRatio;
    }

    // Main renderer instantiation
    this.renderer = new Renderer(this.scene, container);

    this.playBtnSrc = document.getElementById("play-button").src;
    this.pauseBtnSrc = document.getElementById("pause-button").src;

    // Components instantiation
    this.camera = new Camera(this.renderer.threeRenderer);
    this.controls = new Controls(this.camera.threeCamera, document);
    this.loader = new THREE.OBJLoader();
    this.light = new Light(this.scene);

    // Create and place lights in scene
    ['ambient', 'directional'].forEach(l => this.light.place(l));

    /**
     * Setting up interface to create object/zone/trajectory instances.
     */
    this.path = new PathDrawer(this.scene, this);

    new Interaction(this, this.renderer.threeRenderer, this.scene, this.camera.threeCamera, this.controls.threeControls);

    // Create user head
    const dummyHead = new Model(this.scene, this.loader);
    dummyHead.load(false, false);
    // set up object to represent head for trajectories
    this.headObject = new HeadObject(this);

    this.userHeads = {};

    // AxisHelper for the Head Model
    this.axisHelper = new THREE.AxesHelper(60);
    this.axisHelper.rotation.y += Math.PI;
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0x888888,
      dashSize: 30,
      gapSize: 30,
    });

    const points = []
    points.push(new THREE.Vector3(0, 0, -300))
    points.push(new THREE.Vector3(0, 0, 300))

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    // lineGeometry.computeLineDistances();
    this.altitudeHelper = new THREE.Line(lineGeometry, lineMaterial);
    this.altitudeHelper.computeLineDistances();
    this.altitudeHelper.rotation.x = Math.PI / 2;
    this.scene.add(this.altitudeHelper);
    this.scene.add(this.axisHelper);

    // ui elements
    if(navigator.clipboard && window.isSecureContext){
        document.getElementById('container').style.display = 'inline-block';
    }

    document.getElementById('add-object-button').onclick = this.toggleAddObject.bind(this);
    var self = this;

    this.setupTooltips();

    document.getElementById('play-pause-button').onclick = function(){
        self.toggleGlobalPlay(this);
    }
    document.getElementById('undo').onclick = function(){
        if(self.roomCode === null) self.undo();
    }
    document.getElementById('redo').onclick = function(){
        if(self.roomCode === null) self.redo();
    }
    document.getElementById('collab').onclick = function(){
        document.getElementById('roomcode').value = "";
        if(self.roomCode != null){
            document.getElementById('invite-code').innerHTML = self.roomCode;
        } else {
            self.generateInviteCode();
        }
        // disable Undo and Redo buttons
        let undo = document.getElementById('undo');
        let redo = document.getElementById('redo');
        undo.style.opacity = '0.5';
        redo.style.opacity = '0.5';
        undo.classList.remove('active');
        redo.classList.remove('active');
        undo.style.cursor = 'not-allowed';
        redo.style.cursor = 'not-allowed';

        document.getElementById('room-input').style.display = 'block';
        document.getElementById('splashscreen').style.display = 'block';
    }
    document.getElementById('copy-code').onclick = function(){
        if(self.roomCode && navigator.clipboard){
            this.innerHTML = 'Copied!';
            this.style.color = 'white';
            this.style.background = '#f44b76'
            setTimeout(() => { 
                this.innerHTML = 'Copy';
                this.style.background = 'white';
                this.style.color =  '#555';
            }, 1000);
            navigator.clipboard.writeText(self.roomCode);
        }
    }
    document.getElementById('submit-splash').onclick = function(){
      // if you join a room but you're already part of a room,
      // you'll need to leave that room
      let roomCode = document.getElementById('roomcode').value;

      let success = () => {
        self.dbRef.off();
        self.destroyFirebaseScene();
        let oldRoomCode = self.roomCode ? self.roomCode:null;
        let oldHeadKey = self.headKey ? self.headKey.key:null;
        self.roomCode = roomCode;
        if (self.audio.context.state == "suspended"){
          self.audio.context.resume();
        }
        document.getElementById('room-input').style.display = 'none';
        self.dbRef = self.database.ref(roomCode);
        self.stoRef = self.storage.ref().child(roomCode);
        self.setupFirebase();
        self.database.ref(self.inviteCode).remove();
        if(oldRoomCode && oldHeadKey){
            self.database.ref(oldRoomCode).child('users').child(oldHeadKey).remove();
        }
        document.getElementById('splashscreen').style.display = 'none';
      }

      if(roomCode == ''){
        return alert('no code entered');
      } else if(self.roomCode && roomCode == self.roomCode){
        return alert('You\'re already in this room!');
      } else {
        this.value = 'Disabled';
        // check if room exists
        firebase.database().ref(roomCode).once('value', snapshot => {
        if(snapshot.exists()){
            success();
        } else {
            this.value = 'Enabled';
            return alert('Invalid room code. Please try again');
        }
        })
      }
    }
    document.getElementById('exit-code').onclick = function(){
        document.getElementById('splashscreen').style.display = 'none';
    }
    document.getElementById('save').onclick = function() {
      this.data = self.export().then((data) => {
        const a = document.createElement('a');
        a.href = data;
        a.download = 'export.zip';

        document.getElementById('save-status').style.display = 'none';
        document.getElementById('save').style.pointerEvents = 'auto';
        document.getElementById('save').style.opacity = "1";

        a.click();
      });
    }
    document.getElementById('load').onclick = function() {
      if (self.audio.context.state == "suspended") self.audio.context.resume();
      const i = document.getElementById('import');
      i.click();
      i.addEventListener('change', handleFiles, false);

      function handleFiles() {
        self.import(this.files[0]);
      }
    }

    // document.getElementById('copy-button').onclick = function() {
    //   self.copySelectedItem();
    // }
    document.getElementById('search-clear-search-button').onclick = function(){
        self.toggleSearchBar(this);
    }

    this.cameraLabel = document.getElementById('camera-label');
    this.cameraLabel.onclick = this.reset.bind(this);

    this.cameraLabel.innerHTML = this.perspectiveView ? 'Altitude view' : 'Aerial view';

    this.gui = new GUIWindow(this);
    this.soundSearch = new SoundSearch(this);

    // Start render which does not wait for model fully loaded
    this.container.querySelector('#loading').style.display = 'none';
    this.render();

    zip.workerScriptsPath = './assets/js/';

    this.zipHelper = (function() {
      var zipFileEntry,
        zipWriter,
        writer,
        URL = window.URL || window.webkitURL || window.mozURL;

      return {
        addFiles: (files, oninit, onadd, onprogress, onend) => {
          var addIndex = 0;

          function nextFile() {
            var file = files[addIndex];
            onadd(file);
            zipWriter.add(
              file.name,
              new zip.BlobReader(file),
              function() {
                addIndex++;
                if (addIndex < files.length) nextFile();
                else onend();
              },
              onprogress,
            );
          }

          function createZipWriter() {
            zip.createWriter(
              writer,
              function(writer) {
                zipWriter = writer;
                oninit();
                nextFile();
              },
              function(error) {
                console.log(error);
                document.getElementById('save-status').style.display = 'none';
                document.getElementById('save').style.pointerEvents = 'auto';
                document.getElementById('save').style.opacity = "1";
              },
            );
          }

          if (zipWriter) nextFile();
          writer = new zip.BlobWriter();
          createZipWriter();
        },

        getEntries: (file, onend) => {
          zip.createReader(new zip.BlobReader(file), (zipReader) => {
            zipReader.getEntries(onend);
          }, (error) => {
            console.log(error);
            document.getElementById('load-status').style.display = 'none';
            document.getElementById('load').style.pointerEvents = 'auto';
            document.getElementById('load').style.opacity = "1";
          });
        },

        getEntryFile: (entry, onend, onprogress) => {
          var writer, zipFileEntry;

          function getData() {
            entry.getData(writer, (blob) => {
              onend(entry.filename, blob);
            }, onprogress);
          }

          writer = new zip.BlobWriter();
          getData();
        },

        getBlobURL: (callback) => {
          zipWriter.close(function(blob) {
            var blobURL = URL.createObjectURL(blob);
            callback(blobURL);
            zipWriter = null;
          });
        },

        getBlob: (callback) => {
          zipWriter.close(callback);
        },
      };
    })();

    Config.isLoaded = true;
  }

  setupTooltips() {
    let self = this;
    let gui = document.getElementById('guis');
    document.getElementById('tooltip-label').onclick = function() {
        self.toggleTooltip();
    }
    document.getElementById('add-object-button').onmouseenter = function() {
        if (gui.style.opacity == 0) {
            self.addObjectLabel = false;
            self.showTooltip('help-add');
        }
    }
    document.getElementById('add-object-button').onmouseleave = function() {
        if (gui.style.opacity == 0) {
            self.hideTooltip('help-add');
        }
    }
    document.getElementById('camera-label').onmouseenter = function() {
        self.cameraHasLabel = false;
        self.showTooltip('help-camera');
    }
    document.getElementById('camera-label').onmouseleave = function() {
        self.hideTooltip('help-camera');
    }
    
}

  render() {
    // Call render function and pass in created scene and camera
    this.renderer.render(this.scene, this.camera.threeCamera);

    /* Camera tweening object update */
    TWEEN.update();

    /* Updating camera controls. */
    this.controls.threeControls.update();

    /**
     * Hands over the positioning of the listener node from the head model
     * to the camera in object edit view
     **/
    if(this.isEditingObject) this.setListenerPosition(this.camera.threeCamera);

    /**
     * Differentiating between perspective and bird's-eye views. If the camera is tilted
     * enough the perspective view is activated, restring user's placement of object in the
     * X-Z plane
     */
    if (this.controls.threeControls.getPolarAngle() > 0.4) {
      if (!this.perspectiveView) {
        document.getElementById('help-camera').style.display = 'none';
        this.perspectiveView = true;
        this.cameraLabel.innerHTML = 'Altitude view';
      }
    } else if (this.perspectiveView) {
      this.perspectiveView = false;
      this.cameraLabel.innerHTML = 'Aerial view';
    }

    /* Checking if the user has walked into a sound zone in each frame. */
    this.checkZones();

    /* Updating the head model's position and orientation in each frame. */
    this.updateDummyHead(this.headKey);

    /**
     * Stops an object trajectory motion if the used clicks onto a moving object
     */
    for (const i in this.soundObjects) {
      if (!this.isMouseDown || this.soundObjects[i] !== this.activeObject) {
        if (this.soundObjects[i].type === 'SoundObject') {
          this.soundObjects[i].followTrajectory(this.isPlaying);
        }
      }
    }

    /* Making the GUI visible if an object is selected */
    this.gui.display(this.activeObject);

    this.animate(this);
  }

  animate(classToBind, fps = 60){
    setTimeout(() => {
      requestAnimationFrame(this.render.bind(classToBind))
    }, 1000 / fps); // 60fps
  }

  setupFirebase(){
    this.headKey = this.dbRef.child('users').push();
    this.headKey.set({
      position: this.headObject.containerObject.position,
    });
    let self = this;
    function createZone(child){
        let points = child.val().zone.map(function(posi){
            return new THREE.Vector3(posi.x, posi.y, posi.z);
        });
        let createdZone = new SoundZone(self, points, child.key);
        if(child.val().hasOwnProperty('sound')){
            self.stoRef.child('zones/' + child.key + '/' + child.val().sound).getDownloadURL().then(function(url){
                let request = new XMLHttpRequest();
                request.responseType = 'blob';
                request.onload = function(event) {
                let soundFile = request.response;
                soundFile.lastModifiedDate = new Date();
                soundFile.name = child.val().sound;
                // copy soundzone sound
                createdZone.copySound(soundFile, child.val().volume, child.val().isPlaying, true);
                // add soundfile name in html
                }
                request.open("GET", url);
                request.send();
            });
        }
        createdZone.addToScene(self.scene, child.val().position);
        // update zone
        self.soundZones.push(createdZone);
        return createdZone;
    }

    this.dbRef.child('users').child(this.headKey.key).onDisconnect().remove();

    this.gui.updateFirebaseDetails(this.dbRef, this.stoRef, this.headKey.key, this.roomCode);

    function createHeadTrajectory(parent, fbChild){
        self.path.points = fbChild.val().trajectory.map(function(pos) {
            return new THREE.Vector3(pos.x, pos.y, pos.z);
        });
        self.path.parentObject = parent;
        self.path.createObject(self, true, true, false);
        parent.trajectory.ownerHeadKey = fbChild.key;
        parent.calculateMovementSpeed();
    }

    this.dbRef.child('globals').on('child_changed', child => {
        if(child.val().lastEdit != this.headKey.key){
            if(!this.isPlaying){
                this.isPlaying = true;
                let element = document.getElementById('play-pause-button');
                element.innerHTML = 'Pause';
                element.title = 'Pause';
                this.audio.context.resume();
            } else {
                this.isPlaying = false;
                let element = document.getElementById('play-pause-button');
                element.innerHTML = 'Play';
                element.title = 'Play';
                this.audio.context.suspend();
            }
            [].concat(this.soundObjects, this.soundZones).forEach(obj => obj.toggleAppearance(this));
        }
    });

    this.dbRef.child('users').on('child_added', child => {
      if(child.key != this.headKey.key){
        var otherHead = new Model(this.scene, this.loader);
        let otherHeadObj = new HeadObject(this);
        let name = 'user' + (Object.keys(this.userHeads).length + 1).toString();
        if(child.val().trajectory){
            createHeadTrajectory(otherHeadObj, child);
        }
        otherHead.load(true, name, child.val().position, child.key, this.dbRef);
        this.userHeads[child.key] = {
          head: name,
          otherHeadObject: otherHeadObj
        };
      }
    });

    this.dbRef.child('users').on('child_changed', child => {
      let pos = child.val().position;
      if(Object.keys(this.userHeads).length > 0 && child.key != this.headKey.key){
        let newPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        // wait until object is loaded into the scene before searching
        if(this.scene.getObjectByName(this.userHeads[child.key].head, true) == undefined) {
          return;
        }

        let head = this.userHeads[child.key].otherHeadObject;
        if(head.trajectory === null && child.val().trajectory){
          createHeadTrajectory(head, child);
        }
        if(head.trajectory == null && child.val().trajectory == null){
          this.scene.getObjectByName(this.userHeads[child.key].head, true).position.copy(newPos);
        }
        if(head.trajectory != null && head.trajectory != child.val().trajectory){
          if(child.val().trajectory != null){
            head.trajectory.splinePoints = child.val().trajectory.map(function(posi) {
              return new THREE.Vector3(posi.x, posi.y, posi.z);
            });
            head.trajectory.updateTrajectory(true);
            head.calculateMovementSpeed();
          } else {
            this.removeSoundTrajectory(head.trajectory);
            head.trajectory = null;
            this.scene.getObjectByName(this.userHeads[child.key].head, true).position.copy(newPos);
          }
        } 
        if(head.trajectory != null && child.val().speed){
          let speed = child.val().speed;
          head.movementSpeed = Math.min(Math.max(-100, speed), 100);
          head.calculateMovementSpeed();
        }
        if(head.rotation.y != child.val().rotation){
          let other = this.scene.getObjectByName(this.userHeads[child.key].head, true);
          head.rotation.y = child.val().rotation;
          other.rotation.y = head.rotation.y;
        }
      }
    });

    this.dbRef.child('users').on('child_removed', child => {
      if(this.userHeads.hasOwnProperty(child.key)){
        this.scene.remove(this.scene.getObjectByName(this.userHeads[child.key].head, true));
        // remove head trajectory
        if(child.val().trajectory){
            this.removeSoundTrajectory(this.userHeads[child.key].otherHeadObject.trajectory);
        }
        delete this.userHeads[child.key];
      }
      
    });

    this.dbRef.child('objects').on('child_added', child => {
      if(child.val().lastEdit != this.headKey.key){
        let createdObj = null;
        // add trajectory upon initial load
        if(child.val().type == "SoundObject"){
          createdObj = new SoundObject(this, child.key);
          if(child.val().sound){
            this.stoRef.child('soundObjects/'+ child.key +'/' + child.val().sound).getDownloadURL().then(function(url){
              let request = new XMLHttpRequest();
              request.responseType = 'blob';
              request.onload = function(event) {
                let soundFile = request.response;
                soundFile.lastModifiedDate = new Date();
                soundFile.name = child.val().sound;
                createdObj.copyOmnisphereSound(soundFile, child.val().volume, true, child.val().isPlaying);
                // add soundfile name in html
              }
              request.open("GET", url);
              request.send();
            });
          }
          createdObj.addToScene(this.scene, child.val().position);
          this.soundObjects.push(createdObj);
          if(child.val().trajectory){
            this.path.points = child.val().trajectory.map(function(posi) {
              return new THREE.Vector3(posi.x, posi.y, posi.z);
            });
            this.path.parentObject = createdObj;
            this.path.createObject(this, true, true, false);
            createdObj.calculateMovementSpeed();
          }
        } 
      }
      // putting these in here makes it so that the original object that created these won't get these made
      this.dbRef.child('objects').child(child.key).child('cones').on('child_added', childC => {
        // can only run after an object has been added
        let self = this;
        if(childC.val().lastEdit != this.headKey.key && childC.val().hasOwnProperty('sound')){
          let obj = this.soundObjects.find(object =>
            object.containerObject.name == childC.val().parent
          );
        this.stoRef.child('soundObjects/'+ childC.val().parent +'/' + childC.val().uuid + '/' + childC.val().sound).getDownloadURL().then(function(url){
            let request = new XMLHttpRequest();
            request.responseType = 'blob';
            request.onload = function(event) {
            let soundFile = request.response;
            soundFile.lastModifiedDate = new Date();
            soundFile.name = childC.val().sound;
            obj.copyConeSound(soundFile, childC.val().volume, childC.val().latitude,
            childC.val().longitude, childC.val().spread, childC.val().uuid, 
            childC.val().isPlaying)
            }
            request.open("GET", url);
            request.send();
        });
        }
      })

      this.dbRef.child('objects').child(child.key).child('cones').on('child_changed', childC => {
        let obj = this.soundObjects.find(object =>
          object.containerObject.name == childC.val().parent
        );
        let index = obj.cones.findIndex(cone => 
          cone.uuid == childC.val().uuid
        )
        let hasSoundUpdateSound = (index != -1 && childC.val().hasOwnProperty('sound') 
                                    && obj.cones[index].sound && obj.cones[index].filename != childC.val().sound);
        if(childC.val().lastEdit != this.headKey.key && hasSoundUpdateSound){
          // sound exists but sound was changed
            this.stoRef.child('soundObjects/'+ childC.val().parent +'/' + childC.val().uuid + '/' + childC.val().sound).getDownloadURL().then(function(url){
                let request = new XMLHttpRequest();
                request.responseType = 'blob';
                request.onload = function(event) {
                let soundFile = request.response;
                soundFile.lastModifiedDate = new Date();
                soundFile.name = childC.val().sound;
                obj.copyConeSound(soundFile, childC.val().volume, childC.val().latitude,
                    childC.val().longitude, childC.val().spread, childC.val().uuid, childC.val().isPlaying, true);
                
                let soundPicker = document.getElementById('guis').getElementsByClassName('cone')[index];
                soundPicker.querySelector('.fcone').innerHTML = childC.val().sound;
                soundPicker.querySelector('.fcone').defaultValue = childC.val().sound;
                }
                request.open("GET", url);
                request.send();
            });
        } else if(index != -1 && childC.val().lastEdit != this.headKey.key && obj.cones[index].sound && obj.cones[index].sound.state 
            && childC.val().isPlaying == obj.cones[index].sound.state.isAudioPaused) {
            // other child is paused
            if(!childC.val().isPlaying){
              obj.stopConeSound(obj.cones[index]);
              obj.cones[index].userSetPlay = false;
            } else {
              obj.playConeSound(obj.cones[index]);
              obj.cones[index].userSetPlay = true;
            }
        }
        let volume = childC.val().volume;
        let spread = childC.val().spread;
        let latitude = childC.val().latitude;
        let longitude = childC.val().longitude;
        if(index == -1){
            obj.objConeCache[childC.val().uuid] = {
                volume: volume,
                spread: spread,
                latitude: latitude,
                longitude: longitude
            }
        }

        // update sound properties: vol, sprd, long, lat
        if(index != -1 && obj.cones[index].sound != null && childC.val().lastEdit != this.headKey.key){
          if(volume !== obj.cones[index].sound.volume.gain.value){
            obj.cones[index].sound.volume.gain.value = volume;
            obj.changeLength(obj.cones[index]);
          }
          if(spread !== obj.cones[index].sound.spread){
            obj.cones[index].sound.spread = spread;
            obj.changeWidth(obj.cones[index]);
          }
          obj.pointConeMagic(obj.cones[index], latitude, longitude);
        }

      });

      this.dbRef.child('objects').child(child.key).child('cones').on('child_removed', childC => {
        if(this.soundObjects.length > 0 && childC.val().lastEdit != this.headKey.key){
          let obj = this.soundObjects.find(object => 
            object.containerObject.name == childC.val().parent
          )
          let index = obj.cones.findIndex(cone => 
            cone.uuid == childC.val().uuid
          )
          obj.removeCone(obj.cones[index])
          this.activeObject = obj;
          if (this.interactiveCone == null) {
            let addButton = document.getElementById("add-cone");
            addButton.style.position = 'relative';
            addButton.style.removeProperty('top');
            // addButton.style.removeProperty('left');
            addButton.firstChild.style.removeProperty('padding');
            addButton.classList.remove('add-cone-object-view')
          }
        }
    
      });
    });

    this.dbRef.child('zones').on('child_added', child => {
      // at this point, it only has last edit in key
     if(child.val().lastEdit != this.headKey.key && child.val().type == "SoundZone"){
        if(child.val().type == "SoundZone"){
            let zone = createZone(child);
            if (this.activeObject != zone) {
                zone.setInactive(this);
            }
        }
      } 
    });

    this.dbRef.child('objects').on('child_changed', child => {
      if("position" in child.val() && child.val().lastEdit != this.headKey.key){
        let pos = child.val().position;
        let obj = this.soundObjects.find(object =>
          object.containerObject.name == child.key
        );
        // don't move object for user while in edit mode
        if(obj != null && obj != undefined){
          let nonTrajectoryPositionUpdate = false;
          if(obj.trajectory === null && child.val().trajectory){
            let points = child.val().trajectory.map(function(posi) {
                return new THREE.Vector3(posi.x, posi.y, posi.z);
            });
            if(!this.isEditingObject || (this.isEditingObject && this.activeObject != obj)){
                this.path.points = points;
                this.path.parentObject = obj;
                this.path.createObject(this, true, true, false);
                obj.calculateMovementSpeed();
            } else {
                this.trajectoryCache[obj.containerObject.uuid] = points;
                this.trajectoryCache['new'] = true;
            }
            nonTrajectoryPositionUpdate = true;
          }
          
          if(obj.trajectory == null && child.val().trajectory == null){
            if(!this.isEditingObject){
                obj.setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
            } else {
                this.trajectoryCache[obj.containerObject.uuid] = new THREE.Vector3(pos.x, pos.y, pos.z);
            }
            nonTrajectoryPositionUpdate = true;
          }
          
          let trajectoryEqual = true;
          if (obj.trajectory) {
            let length = obj.trajectory.points.length;
            if (!child.val().hasOwnProperty('trajectory') || length !== child.val().trajectory.length) {
                trajectoryEqual = false;
            } else {
                for (var i = 0; i < length; ++i) {
                    if (obj.trajectory.points[i].x !== child.val().trajectory[i].x || 
                        obj.trajectory.points[i].y !== child.val().trajectory[i].y ||
                        obj.trajectory.points[i].z !== child.val().trajectory[i].z) {
                        trajectoryEqual = false;
                        break;
                    }
                }
            }
          }

          if(obj.trajectory != null && !trajectoryEqual){
            if(child.val().trajectory != null){
              let trajectory = child.val().trajectory.map(function(posi) {
                return new THREE.Vector3(posi.x, posi.y, posi.z);
              });

              // pull updates and store aside until user is done editing object
              if(!this.isEditingObject){
                obj.trajectory.splinePoints = trajectory;
                obj.trajectory.points = trajectory;
                obj.trajectory.updateTrajectory(true);
                obj.calculateMovementSpeed();
              } else {
                this.trajectoryCache[obj.containerObject.uuid] = trajectory;
                this.trajectoryCache['path'] = true;
              }
              // obj.trajectory.setCopyPosition(posVec);
            } else {
              let previousActiveObject = this.activeObject;
              this.removeSoundTrajectory(obj.trajectory);
              obj.trajectory = null;
              this.activeObject = previousActiveObject;
              // don't set the new position until out of edit object
              if(!this.isEditingObject || (this.isEditingObject && this.activeObject != obj)){
                obj.setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
              } else {
                this.trajectoryCache[obj.containerObject.uuid] = new THREE.Vector3(pos.x, pos.y, pos.z);
              }
            }
            nonTrajectoryPositionUpdate = true;
          } 
          
          if(obj.trajectory != null && child.val().speed != null && child.val().speed != obj.movementSpeed) {
            let speed = child.val().speed;
            obj.movementSpeed = Math.min(Math.max(-100, speed), 100);
            obj.calculateMovementSpeed();
            nonTrajectoryPositionUpdate = true;
          }

          // update sound file if available
          if(obj.filename != null && (!child.val().hasOwnProperty('sound') || child.val().sound == '') && obj.omniSphere.sound){
            nonTrajectoryPositionUpdate = true;
            obj.disconnectSound();
            let soundPicker = document.getElementById('guis').querySelector('#omnisphere-sound-loader');
            soundPicker.querySelector('.valueSpan').innerHTML = 'None';
            soundPicker.querySelector('.remove-file').style.display = 'none';
          }

          if(child.val().hasOwnProperty('sound') && child.val().sound != '' && obj.filename != child.val().sound && !obj.isAddingSound){
            nonTrajectoryPositionUpdate = true;
            obj.isAddingSound = true;
            this.stoRef.child('soundObjects/'+ child.key +'/' + child.val().sound).getDownloadURL().then(function(url){
              let request = new XMLHttpRequest();
              request.responseType = 'blob';
              request.onload = function(event) {
                let soundFile = request.response;
                // Convert blob to File
                soundFile.lastModifiedDate = new Date();
                soundFile.name = child.val().sound;
                obj.copyOmnisphereSound(soundFile, child.val().volume, true, child.val().isPlaying);
                // replace soundFile name
                let soundPicker = document.getElementById('guis').querySelector('#omnisphere-sound-loader');
                if (soundPicker) {
                    soundPicker.querySelector('.valueSpan').innerHTML = child.val().sound;
                    soundPicker.querySelector('.valueSpan').defaultValue = child.val().sound;
                    soundPicker.querySelector('.remove-file').style.display = 'inline-block';
                }
              }
              request.open("GET", url);
              request.send();
            });
          } else if((obj.omniSphere.sound && obj.omniSphere.sound.state && child.val().isPlaying == obj.omniSphere.sound.state.isAudioPaused)) {
            nonTrajectoryPositionUpdate = true;
            if(!child.val().isPlaying){
                obj.stopSound();
                obj.userSetPlay = false;
            } 
            else {
                // if isPlaying is false, it could either mean that a global pause is in place
                // or it could also mean a global pause has been used before, just no sound
                obj.playSound();
                obj.userSetPlay = true;
            }
          } 

          if(obj.omniSphere.sound != null){
            obj.omniSphere.sound.volume.gain.value = child.val().volume;
            obj.changeRadius();
          }

          if(!nonTrajectoryPositionUpdate && obj.trajectory != null && child.val().trajectoryPosition) {
            obj.trajectoryClock = child.val().trajectoryPosition;
          }
        }
      } 
    });

    this.dbRef.child('zones').on('child_changed', child => {
      let zone = this.soundZones.find(zone =>
        zone.containerObject.name == child.key
      );
      // update position, sound, volume, rotation, scale
      let zoneUp = false, rotUp = false, scaleUp = false;
      let pos = child.val().position;
      if(child.val().lastEdit != this.headKey.key && child.val().type == "SoundZone"){
        let zonePos = zone.containerObject.position;
        // update zonePosition
        if(zonePos.x != pos.x || zonePos.y != pos.y || zonePos.z != pos.z){
          zone.containerObject.position.copy(new THREE.Vector3(pos.x, pos.y, pos.z));
        } 
        // update rotation
        if(zone.containerObject.rotation.y != child.val().rotation){
          zone.containerObject.rotation.y = child.val().rotation;
          rotUp = true;
        }
        // update scale
        if(zone.zoneScale != child.val().scale){
          zone.zoneScale = child.val().scale;
          zone.updateZoneScale(child.val().prev, true)
          scaleUp = true;
        }
        // update sound
        if (zone.filename != null && (!child.val().hasOwnProperty('sound') || child.val().sound == '') && zone.sound) {
            zone.clear();
            var materialColor = this.isPlaying ? 0xFF1169 : 0x8F8F8F;
            zone.shape.material.color.setHex(materialColor);
            zone.filename = null;
        }
        if(child.val().hasOwnProperty('sound') && child.val().sound != '' && child.val().lastEdit != this.headKey.key
            && zone.filename != child.val().sound && !zone.isAddingSound){
            zone.isAddingSound = true;
          this.stoRef.child('zones/' + child.key + '/' + child.val().sound).getDownloadURL().then(function(url){
            let request = new XMLHttpRequest();
            request.responseType = 'blob';
            request.onload = function(event) {
              let soundFile = request.response;
              // Convert blob to File
              soundFile.lastModifiedDate = new Date();
              soundFile.name = child.val().sound;
              zone.copySound(soundFile, child.val().volume, child.val().isPlaying, true);
              // replace soundFile name
              let soundPicker = document.getElementById('guis').querySelector('#zone-sound');
              if (soundPicker) {
                soundPicker.querySelector('.valueSpan').innerHTML = child.val().sound;
                soundPicker.querySelector('.valueSpan').defaultValue = child.val().sound;
                soundPicker.querySelector('.remove-file').style.display = 'inline-block';
              }
            }
            request.open("GET", url);
            request.send();
          });
        } else if(child.val().lastEdit != this.headKey.key && zone.sound && zone.sound.state 
                  && child.val().isPlaying == zone.sound.state.isAudioPaused) {
            if(!child.val().isPlaying){
              zone.stopSound();
              zone.userSetPlay = false;
            } else {
              zone.playSound();
              zone.userSetPlay = true;
            }
        }
  
        // update volume
        if(zone.sound != null && zone.sound.volume.gain.value != child.val().volume){
          zone.sound.source.volume.gain.value = child.val().volume;
          zone.volume = child.val().volume;
        }

        // update zone points whenever movement occurs       
        let zoneEqual = true;
        if (zone.splinePoints.length !== child.val().zone.length) {
            zoneEqual = false;
        } else {
            for (var i = 0; i < zone.splinePoints.length; ++i) {
                if (zone.splinePoints[i].x !== child.val().zone[i].x || 
                    zone.splinePoints[i].y !== child.val().zone[i].y ||
                    zone.splinePoints[i].z !== child.val().zone[i].z) {
                    zoneEqual = false;
                    break;
                }
            }
        }

        if(!zoneEqual  && !scaleUp && !rotUp){
          let previousSplinePoints = Array.from(zone.splinePoints);
          zone.splinePoints = child.val().zone.map(function(posi) {
            return new THREE.Vector3(posi.x, posi.y, posi.z)
          });

          let updateType = null;
          let index = -1;
          let findPoint = (point, splinePointArray) => {
            return splinePointArray.find(function(p) {
              return Math.abs(p.x - point.x) <= TOLERANCE && Math.abs(p.y - point.y) <= TOLERANCE 
              && Math.abs(p.z - point.z) <= TOLERANCE;
            });
          };

          let findIndex = (p, splinePointArray) => {
            for(let i = 0; i < splinePointArray.length; ++i){
                let currentPoint = splinePointArray[i];
                if(Math.abs(p.x - currentPoint.x) <= TOLERANCE && Math.abs(p.y - currentPoint.y) <= TOLERANCE 
                    && Math.abs(p.z - currentPoint.z) <= TOLERANCE){
                    return i;
                }
            }
            return -1;
          };
              
          if(previousSplinePoints.length < zone.splinePoints.length){
            updateType = 'add';
            let difference = zone.splinePoints.filter(point => !findPoint(point, previousSplinePoints));
            index = findIndex(difference[0], zone.splinePoints);
          } else if (previousSplinePoints.length > zone.splinePoints.length){
            updateType = 'delete';
            let difference = previousSplinePoints.filter(point => !findPoint(point, zone.splinePoints));
            index = findIndex(difference[0], previousSplinePoints);
          }

          zone.updateZone({updateType: updateType, index: index}, true);
          zone.updatePointObjects();
        }
  
        if(rotUp || scaleUp){
          zone.updatePointObjects();
          zone.updateZone(null, true);
        }
      }
    });

    this.dbRef.child('objects').on('child_removed', child => {
      if("position" in child.val() ){
        let pos = child.val().position;
        let obj = this.soundObjects.find(object =>
          object.containerObject.name == child.key
        );
        if(obj != undefined){
          // remove trajectory if object has trajectory
          if(obj.trajectory){
            this.removeSoundTrajectory(obj.trajectory);
            obj.trajectory = null;
            obj.setPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
          }
          this.removeSoundObject(obj);
          // close gui if in edit mode
          if(this.isEditingObject && this.activeObject == obj){
              this.exitEditObjectView();
          }
          this.activeObject = null;
        }
      }
    });

    this.dbRef.child('zones').on('child_removed', child => {
      let zone = this.soundZones.find(zone => zone.containerObject.name == child.key);
      if(zone != undefined){
        // delete audioFile
        this.removeSoundZone(zone);
        this.activeObject = null;
      }
    });
  }

  populateFirebaseScene(){
    // push all soundObjects, trajectories, zones, sounds
    // update firebase details for all items
    this.soundObjects.forEach((soundObject) => {
        soundObject.updateFirebaseDetails(this.dbRef, this.stoRef, this.headKey, this.roomCode);
    });
    this.soundZones.forEach((soundZone) => {
        soundZone.updateFirebaseDetails(this.dbRef, this.stoRef, this.headKey, this.roomCode);
    });
    // upload head trajectory
    if(this.headObject.trajectory){
        this.headObject.trajectory.updateFirebaseDetails(this.dbRef, this.stoRef, this.headKey, this.roomCode);
    }
  }


  destroyFirebaseScene(){
    // destroy old firebase session and remove all soundobjects and cones
    this.soundObjects.forEach((soundObject) => {
        soundObject.removeFromScene(this.scene);
    });
    this.soundZones.forEach((soundZone) => {
        soundZone.removeFromScene(this.scene);
    });
    this.soundObjects = [];
    this.soundZones = [];
    // remove other users heads
    let keys = Object.entries(this.userHeads).map(o => o[0])

    keys.forEach((key) =>{
        this.scene.remove(this.scene.getObjectByName(this.userHeads[key].head, true));
        delete this.userHeads[key];
    });
    // reset our head position and rotation
    this.headObject.setPosition(new THREE.Vector3(0,0,0));
    // this.headObject.setRotation(new THREE.Vector3(0, 0, 0));
  }

  generateInviteCode(){
    if(this.inviteCode === null) {
        this.inviteCode =  Math.random().toString(36).substr(2, 7).toUpperCase();
        if(this.audio.context.state === "suspended"){
          this.audio.context.resume();
        }
    }
    let self = this;
      fetch('https://us-central1-inviso-c8758.cloudfunctions.net/getTotalSize')
      .then(response => response.json())
      .then(data => {
          console.log(data);
          if ( data.numSubdirectories > 10 ) {
            // TODO: if there are 10 rooms already, prevent creation of invite code and
            // give message saying too many rooms, check each time
          }
      })
      .catch(error => {
          console.error('Error:', error);
      });
    firebase.database().ref(self.inviteCode).once('value', snapshot => {
        if(!snapshot.exists()){
            document.getElementById('invite-code').innerHTML = self.inviteCode;
            self.roomCode = self.inviteCode;
            self.dbRef = self.database.ref(self.roomCode);
            self.stoRef = self.storage.ref().child(self.roomCode);
            this.dbRef.child('globals').child('sound').set({
                globalIsPlaying: this.isPlaying,
            });
            self.setupFirebase();
            self.populateFirebaseScene();
        } 
    });
  }

  setupAudio() {
    const a = {};
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    a.context = new AudioContext();
    a.context.listener.setOrientation(0, 0, -1, 0, 1, 0);
    a.context.listener.setPosition(0, 0, 0);
    a.destination = a.context.createGain();
    a.destination.connect(a.context.destination);
    a.context.destination.channelCount = a.context.destination.maxChannelCount;
    a.context.destination.channelCountMode = "explicit";
    a.context.destination.channelInterpretation = "discrete";
    this.audio = a;
    this.audio.context.suspend();
  }

  setListenerPosition(object) {
    const q = new THREE.Vector3();
    object.updateMatrixWorld();
    q.setFromMatrixPosition(object.matrixWorld);
    this.audio.context.listener.setPosition(q.x, q.y, q.z);

    const m = object.matrix;
    const mx = m.elements[12];
    const my = m.elements[13];
    const mz = m.elements[14];
    m.elements[12] = m.elements[13] = m.elements[14] = 0;

    const vec = new THREE.Vector3(0, 0, -1);
    vec.applyMatrix4(m);
    vec.normalize();

    const up = new THREE.Vector3(0, -1, 0);
    up.applyMatrix4(m);
    up.normalize();

    this.audio.context.listener.setOrientation(vec.x, vec.y, vec.z, up.x, up.y, up.z);

    m.elements[12] = mx;
    m.elements[13] = my;
    m.elements[14] = mz;
  }

  /**
   * Checks if the user has walked into a sound zone by raycasting from the
   * head model's position onto each sound zone into scene and checking if there
   * is a hit. The headmodel is first normalized to the horizontal plane since,
   * with the introduction of head trajectories, the head model can move beneath
   * this plane which causes the downwards raycas to miss the zone.
   */
  checkZones() {
    if (this.soundZones.length > 0) {
      const walkingRayVector = new THREE.Vector3(0, -1, 0);
      const normalizedHeadVector = new THREE.Vector3(this.head.position.x, 1, this.head.position.z);
      this.walkingRay.set(normalizedHeadVector, walkingRayVector);

      for (const i in this.soundZones) {
        const intersects = this.walkingRay.intersectObject(this.soundZones[i].shape);
        if (intersects.length > 0) {
          /**
           * Flagging a zone "under user" to activate the audio file associated
           * with the sound zone.
           */
          this.soundZones[i].underUser(this.audio);
        } else {
          let isRender = true;
          this.soundZones[i].notUnderUser(this.audio, isRender);
        }
      }
    }
  }

  tweenToObjectView() {
    if (this.isEditingObject) {
      let vec = new THREE.Vector3().subVectors(this.camera.threeCamera.position, this.activeObject.containerObject.position);
      vec.y = this.activeObject.containerObject.position.y;
      this.cameraDestination = this.activeObject.containerObject.position.clone().addScaledVector(vec.normalize(), 500);

      new TWEEN.Tween(this.camera.threeCamera.position)
        .to(this.cameraDestination, 800)
        .start();

      new TWEEN.Tween(this.controls.threeControls.center)
        .to(this.activeObject.containerObject.position, 800)
        .start();

      /**
       * Edit Object View only applies to sound objects. A Sound Object in the scene
       * is represented with 4 elements: Raycast Sphere Mesh, AxisHelper,
       * AltitudeHelper Line, and the containerObject which holds the omniSphere
       * and the cones. To make only the activeObject and nothing else in the scene,
       * first we set every object after scene defaults (i.e. grid, collider plane,
       * lights, edit view light box and camera helper) invisible. Then we find the
       * index of the raycast sphere that belongs to the active object and make
       * this and the following 3 object visible to bring the activeObject back
       * in the scene.
       **/

      if (this.head) {
        this.head.visible = false;
        //this.head.children[0].material.opacity = 0.05;
        this.axisHelper.visible = false;
        this.altitudeHelper.visible = false;
      }
      this.gui.disableGlobalParameters();
      [].concat(this.soundObjects, this.soundZones).forEach((object) => {
        if (object !== this.activeObject) {
          if (object.type === "SoundObject") {
            object.axisHelper.visible = false;
            object.altitudeHelper.visible = false;
            object.cones.forEach(cone => cone.material.opacity = 0.1);
            object.omniSphere.material.opacity = 0.2;
          }
          else if (object.type === "SoundZone") {
            object.shape.material.opacity = 0.05;
          }
        }

        if (object.type === "SoundObject") {
          object.pause();
          if (object === this.activeObject) {
            object.axisHelper.visible = true;
            object.axisHelper.visible = true;
            object.altitudeHelper.visible = true;
            object.cones.forEach(cone => cone.material.opacity = 0.8);
            object.omniSphere.material.opacity = 0.8;
          }
        }
      });

      /* lightbox effect */
      this.renderer.threeRenderer.setClearColor(0xbbeeff);   
    }
  }

  enterEditObjectView() {
    this.toggleAddTrajectory(false);
    document.getElementById('camera-label').style.display = 'none';

    // disable panning in object view
    this.controls.disablePan();
    let trajectory = document.getElementById('add-trajectory');
    if (trajectory) {
        trajectory.style.display = 'none';
    }
    // disable copy/paste functionality
    // document.getElementById('copy').style.pointerEvents = 'none';
    // document.getElementById('copy').style.opacity = "0.5";

    // move add cone button to position above

    // slightly hacky fix: orbit controls tween works poorly from top view
    if (this.controls.threeControls.getPolarAngle() < 0.01) {
      this.controls.threeControls.constraint.rotateUp(-0.02);
      this.controls.threeControls.update();
    }

    let addButton = document.getElementById('add-cone')
    if(addButton && addButton.firstChild.style.padding != '1.5% 4%'){
        addButton.firstChild.style.padding = '1.5% 4%';
    }

    if (!this.isEditingObject) {
      this.isEditingObject = true;
      this.isAddingObject = this.isAddingTrajectory = false;
      this.originalCameraPosition = this.camera.threeCamera.position.clone();
      this.originalCameraCenter = this.controls.threeControls.center.clone();
      // make other user heads invisible
      for(let [key, value] of Object.entries(this.userHeads)){
          if(key !== this.headKey.key){
              let head = this.scene.getObjectByName(value['head'], true);
              head.visible = false;
              head.containerObject = false;
          }
      }
    }

    if (this.activeObject.type == 'SoundTrajectory') {
      // return control to parent sound object
      this.activeObject.deselectPoint();
      this.activeObject = this.activeObject.parentSoundObject;
    }

    var trajectoryElement = document.getElementById('trajectory');
    if (trajectoryElement) {
        trajectoryElement.style.display = 'none';
    }

    this.tweenToObjectView();

    if(this.tooltipShow){
        document.getElementById('help-head').style.display = 'none';
        document.getElementById('help-camera').style.display = 'none';
    }
  }

  exitEditObjectView(reset){
    document.getElementById('camera-label').style.display = 'block';
    let addTrajectory = document.getElementById('add-trajectory');
    
    if (addTrajectory){
        addTrajectory.style.display = 'block';
    }
    // re-enable panning
    this.controls.enablePan();

    // re-enable copy-paste functionality
    // document.getElementById('copy').style.pointerEvents = 'auto';
    // document.getElementById('copy').style.opacity = "1";

    if (this.gui.editor) { this.gui.exitEditorGui(); }
    this.isEditingObject = false;
    if (this.head) {
      this.head.visible = true;
      this.axisHelper.visible = true;
      this.altitudeHelper.visible = true;
      // make other user heads invisible
      for(let [key, value] of Object.entries(this.userHeads)){
        if(key !== this.headKey.key){
            let head = this.scene.getObjectByName(value['head'], true);
            head.visible = true;
            head.containerObject = true;
        }
      }
    }
    this.gui.enableGlobalParameters();
    [].concat(this.soundObjects, this.soundZones).forEach((object) => {
      if (object.type === "SoundObject") {
        object.axisHelper.visible = true;
        object.altitudeHelper.visible = true;
        object.cones.forEach(cone => cone.material.opacity = 0.8);
        object.omniSphere.material.opacity = 0.8;
        object.unpause();
      }
      else if (object.type === "SoundZone") {
        object.shape.material.opacity = Helpers.mapRange(object.volume, 0, 2, 0.05, 0.35);
        // object.shape.visible = true;
      }
    });

    if (!this.isAddingTrajectory && !this.isAddingObject && !reset) {
      new TWEEN.Tween(this.camera.threeCamera.position)
        .to(this.originalCameraPosition, 800)
        .start();

      new TWEEN.Tween(this.controls.threeControls.center)
        .to(this.originalCameraCenter, 800)
        .start();
    }
    /* turn off lightbox effect */
    let uuid = this.activeObject.containerObject.uuid;
    this.renderer.threeRenderer.setClearColor(0xf0f0f0);
    if(uuid in this.trajectoryCache){
        if('new' in this.trajectoryCache){
            this.path.points = this.trajectoryCache[uuid];
            this.path.parentObject = this.activeObject;
            this.path.createObject(this, true, true, false);
            this.activeObject.calculateMovementSpeed();
        } 
        else if('path' in this.trajectoryCache){
            this.activeObject.trajectory.splinePoints = this.trajectoryCache[uuid];
            this.activeObject.trajectory.points = this.trajectoryCache[uuid];
            this.activeObject.trajectory.updateTrajectory(true);
            this.activeObject.calculateMovementSpeed();
        }
        else {
            this.activeObject.setPosition(this.trajectoryCache[uuid]);
        }
        this.trajectoryCache = {};
    }
    if(this.tooltipShow){
        if(!this.movedHead){
          document.getElementById('help-head').style.display = 'inline-block';
        }
        if(this.cameraHasLabel){
          document.getElementById('help-camera').style.display = 'inline-block';
        }
    }
    var trajectoryElement = document.getElementById('trajectory');
    if (trajectoryElement) {
        trajectoryElement.style.display = 'block';
    }
  }

  reset() {
    var zoomAmount = this.camera.threeCamera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    if (this.isEditingObject) {
      this.exitEditObjectView(true);
    }
    this.controls.threeControls.reset();
    this.camera.threeCamera.position.set(0, zoomAmount, 0);
  }

  set audio(audio) {
    this._audio = audio;
  }

  get audio() {
    return this._audio;
  }

  /**
   * Sets the trajectory adding state on. If the scene is in perspective view when
   * this is called, it will be reset to bird's eye.
   */
  toggleAddTrajectory(state) {
    var btn = document.querySelector('#add-trajectory > .button');
    this.isAddingTrajectory = (state === undefined) ? !this.isAddingTrajectory : state;
    if(this.isAddingTrajectory === true){
      btn.classList.toggle('active');
      this.activeObject.oldPosition =
        new THREE.Vector3(this.activeObject.containerObject.position.x,
                          this.activeObject.containerObject.position.y,
                          this.activeObject.containerObject.position.z);
    }
    const trajectoryElement = document.getElementById('add-trajectory');
    if (trajectoryElement) {
      trajectoryElement.classList.toggle('active', this.isAddingTrajectory);
    }
    this.isAllowMouseDrag = true;
    this.reset();
  }

  /**
   * Sets the object adding state on. If the scene is in perspective view when
   * this is called, it will be reset to bird's eye.
   */
  toggleAddObject() {
    if (this.audio.context.state == "suspended") this.audio.context.resume();
    this.isAddingObject = !this.isAddingObject;
    if (this.isAddingTrajectory) {
      this.toggleAddTrajectory(false);
    }
    this.reset();

    var btn = document.getElementById('add-object-button');
    var img = document.getElementById('add-object-button-image');
    btn.classList.toggle('active', this.isAddingObject);
    img.src = this.isAddingObject ? './assets/models/button_cancel.png' : './assets/models/button_add.png';

    document.getElementById('help-add').style.display = 'none';
  }

  /**
   * Sets the the last clicked (active) object.
   * Calls a "secActive()" function ob the selected object.
   */
  setActiveObject(obj) {
    if (this.activeObject) {
      this.activeObject.setInactive();
    }

    this.activeObject = obj;

    if (obj) {
      if (obj.cones && obj.cones.length > 0) {
        this.interactiveCone = obj.cones[0];
      }
      obj.setActive(this);
    }
  }

  /* Updates the user's head model's position and orientation in each frame. Also
  updates collaborative user's head model preview for the user. */
  updateDummyHead(key) {
    if(key != null){
      key = key.key;
    }
    this.head = this.scene.getObjectByName('dummyHead', true);
    // for current user's head
    if (this.head && ((this.isAddingTrajectory && (this.activeObject && this.activeObject.type == 'HeadObject'))
      || (this.isAllowMouseDrag && !this.headObject.trajectory)
      || (this.isMouseDown && this.headObject.trajectory && (this.activeObject && this.activeObject.type == 'HeadObject')))
      && !this.isEditingObject) {
      // If adding trajectory, moving head using mouse, or moving head using mouse while on trajectory, head follows object
        this.altitudeHelper.position.copy(this.headObject.containerObject.position);
        this.altitudeHelper.position.y = 0;
        this.axisHelper.position.copy(this.headObject.containerObject.position);
        this.head.position.copy(this.headObject.containerObject.position);
        this.axisHelper.rotation.y = this.headObject.rotation.y;
        this.head.rotation.y = this.headObject.rotation.y;
        this.setListenerPosition(this.head);

    }
    else if (this.head && this.headObject.trajectory && !this.isEditingObject) {
      // If following trajectory, head follows object
      this.headObject.followTrajectory(this.isPlaying);
      this.altitudeHelper.position.copy(this.headObject.containerObject.position);
      this.altitudeHelper.position.y = 0;
      this.axisHelper.position.copy(this.headObject.containerObject.position);
      this.head.position.copy(this.headObject.containerObject.position);
      this.headObject.rotation.y = this.head.rotation.y;
      this.setListenerPosition(this.head);
    }
    else if (this.head && !this.isEditingObject) {
      // Object follow head
      this.axisHelper.rotation.y += -this.yawLeft + this.yawRight;
      this.head.rotation.y += -this.yawLeft + this.yawRight;
      this.axisHelper.translateZ(-this.moveBackwards + this.moveForward);
      this.head.translateZ(-this.moveBackwards + this.moveForward);
      this.setListenerPosition(this.head);

      this.headObject.containerObject.position.copy(this.head.position);
      this.headObject.rotation.y = this.head.rotation.y;
      this.altitudeHelper.position.copy(this.headObject.containerObject.position);
      this.altitudeHelper.position.y = 0;
    }
    if(this.roomCode != null && this.head != null &&
       this.headObject.trajectory == null && key != null){
      this.dbRef.child('users').child(key).update({
        position: this.head.position,
        rotation: this.head.rotation.y
      });
    }
    for(let keyVal in this.userHeads){
      let headObj = this.userHeads[keyVal].otherHeadObject;
      if(headObj.trajectory != null){
        let name = this.userHeads[keyVal].head;
        let other = this.scene.getObjectByName(name, true);
        if(other == undefined){
            return;
        }
        headObj.followTrajectory(this.isPlaying, other);
        other.position.copy(headObj.containerObject.position);
        headObj.rotation.y = other.rotation.y;
      }
  }
  }

  setMousePosition(event) {
    const pointer = new THREE.Vector3();
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);

    this.nonScaledMouse = pointer;

    this.ray.setFromCamera(pointer, this.camera.threeCamera);

    const intersects = this.ray.intersectObject(this.floor);
    if (intersects.length > 0) {
      this.mouse = intersects[0].point;
    }
  }

  toggleSearchBar(element = null) {
    if (this.soundSearch.isShowing) {
      this.soundSearch.hide();
      if (element) {
        element.innerHTML = 'Search for Sounds';
      } else {
        document.getElementById('search-clear-search-button').innerHTML = 'Search for Sounds'
      }
    }
    else {
      this.soundSearch.display();
      element.innerHTML = 'Close Search Bar'
    }
  }

  toggleGlobalPlay(element) {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
        element.innerHTML = 'Pause';
        element.title = 'Pause'
        this.audio.context.resume();
    } else {
        element.innerHTML = 'Play';
        element.title = 'Play';
        this.audio.context.suspend();
    }

    [].concat(this.soundObjects, this.soundZones).forEach(obj => obj.toggleAppearance(this))
    if (this.roomCode != null) {
    // TODO: must edit the cloud function on room deletion to also remove this globalIsPlaying value
        this.dbRef.child('globals').child('sound').update({
            globalIsPlaying: this.isPlaying,
            lastEdit: this.headKey.key
        });
    }
  }

  // TODO: Remove this function and its dependencies
  toggleGlobalMute() {
    this.isMuted = !this.isMuted;
    [].concat(this.soundObjects, this.soundZones).forEach(sound => sound.checkMuteState(this));
  }

  toggleTooltip() {
    document.getElementById('tooltip-label').innerHTML = this.tooltipShow ? 'Enable Tooltips' : 'Disable Tooltips';
    this.tooltipShow = !this.tooltipShow;
    if(!this.tooltipShow){ // tooltip visible to invisible
      document.getElementById('tooltips').value = 'false';
      // remove visible help bubbles
      [].slice.call(document.getElementsByClassName('help-bubble')).forEach(function(element){
        element.style.display = 'none';
      });
    } else { // tooltip invisible to visible
      document.getElementById('tooltips').value = 'true';
      if(!this.movedHead){
        document.getElementById('help-head').style.display = 'inline-block';
      }
      if(this.addObjectLabel){
        document.getElementById('help-add').style.display = 'inline-block';
      }
      if(this.cameraHasLabel){
        document.getElementById('help-camera').style.display = 'inline-block';
      }
    }
  }

  showTooltip(elementId) {
    if (this.tooltipShow) {
      document.getElementById(elementId).style.display = 'inline-block';
    }
  }

  hideTooltip(elementId) {
    document.getElementById(elementId).style.display = 'none';
  }

  headObjectTooltip(){
    if(!this.isMouseDown && this.tooltipShow){
      if(this.headObject.isUnderMouse(this.ray)){
        var top = 0;
        var left = 0;
        this.movedHead = true;
        var coreCameraPositionX = this.camera.threeCamera.position.x;
        var coreCameraPositionY = this.camera.threeCamera.position.z;
        if(!this.perspectiveView){
          if(this.headObject.containerObject.position.x <= coreCameraPositionX){
            left = Math.max(0, (window.innerWidth  / 2 + ((this.headObject.containerObject.position.x - coreCameraPositionX) / 2.8709)) + 50);
          } else {
            left = Math.min(window.innerWidth ,
              (window.innerWidth / 2 + ((this.headObject.containerObject.position.x - coreCameraPositionX) / 2.8709)) - 350);
          }

          if (this.headObject.containerObject.position.z <= coreCameraPositionY){
            top = (window.innerHeight / 2) - (-1 * (this.headObject.containerObject.position.z - coreCameraPositionY) / 2.8709) + 35;
            } else {
            top = ((window.innerHeight / 2) + ((this.headObject.containerObject.position.z - coreCameraPositionY) / 2.8709)) - 80;
          }
          document.getElementById('help-head').style.left = (left).toString() + 'px';
          document.getElementById('help-head').style.top = top.toString() + 'px';
          document.getElementById('help-head').style.marginLeft = 0;
        } else if(this.perspectiveView){
          document.getElementById('help-head').style.left = "50%";
          document.getElementById('help-head').style.top = "40%";
        }
        this.showTooltip('help-head');
      } else {
        if(this.movedHead){
          this.hideTooltip('help-head');
        }
      }
    } else {
      if(this.movedHead){
        this.hideTooltip('help-head');
      }
    }
  }

  muteAll(excludedSounds) {
    var sounds = [].concat(this.soundObjects, this.soundZones);

    if (excludedSounds) {
      excludedSounds = [].concat(excludedSounds);
      sounds = sounds.filter(sound => excludedSounds.indexOf(sound) < 0);
    }

    sounds.forEach(sound => sound.mute(this));
  }

  unmuteAll(excludedSounds) {
    var sounds = [].concat(this.soundObjects, this.soundZones);

    if (excludedSounds) {
      excludedSounds = [].concat(excludedSounds);
      sounds = sounds.filter(sound => excludedSounds.indexOf(sound) < 0);
    }

    sounds.forEach(sound => sound.unmute(this));
  }

  removeSoundZone(soundZone, flag = true) {
    const i = this.soundZones.indexOf(soundZone);
    this.soundZones[i].notUnderUser(this.audio);
    soundZone.removeFromScene(this.scene);
    this.soundZones.splice(i, 1);
    // if(flag)
    //   this.undoableActionStack.push(new Action(soundZone, 'removeSoundZone'));
  }

  removeSoundObject(soundObject, flag = true) {
    soundObject.isLiveInput = false;
    soundObject.stopMediaStream();
    soundObject.removeFromScene(this.scene);
    const i = this.soundObjects.indexOf(soundObject);
    this.soundObjects.splice(i, 1);
    if(flag == "combo"){
      if(soundObject.trajectory){
        this.removeSoundTrajectory(soundObject.trajectory, "combo");
      }
    }
  }

  removeCone(object, cone, flag = true) {
    object.removeCone(cone);
  }

  removeSoundTrajectory(soundTrajectory, flag = true) {
    if(soundTrajectory.parentSoundObject.hasBeenMoved){
      this.changeTrajectoryLocation(soundTrajectory.parentSoundObject.trajectory, soundTrajectory);
      this.changeUndoRedoActions(soundTrajectory.parentSoundObject.containerObject.uuid, 'trajectoryPos', soundTrajectory);
    }

    soundTrajectory.parentSoundObject.lastPathPosition.copy(soundTrajectory.parentSoundObject.containerObject.position);
    soundTrajectory.parentSoundObject.trajectory.removeFromScene(this.scene);
    const i = this.soundTrajectories.indexOf(soundTrajectory);
    this.soundTrajectories.splice(i, 1);

    if(flag != "gui"){
      soundTrajectory.parentSoundObject.trajectory = null;
      var elem = document.getElementById('trajectory');
      if(elem != null){
        elem.parentNode.removeChild(elem);
      }
      this.gui.addTrajectoryDialog();
    }
    this.activeObject = soundTrajectory.parentSoundObject;
    if (this.activeObject.type === "HeadObject") {
      this.activeObject.resetPosition();
    } else if (this.activeObject.type === "SoundTrajectory" && this.activeObject.parentSoundObject.type === "HeadObject") {
      this.activeObject.parentSoundObject.resetPosition();
    }

    if(flag == true){
      this.undoableActionStack.push(new Action(soundTrajectory, 'removeSoundTrajectory'));
    }

  }

  addSoundTrajectory(soundTrajectory, object, flag = true){
    var delX = 0;
    var delY = 0;
    var delZ = 0;
    var item = this.headObject;
    if (object.type == 'SoundObject'){
      item = this.findObject(object.containerObject.uuid, 'soundObject');
    }

    var currentPosition = item.containerObject.position;

    // oldPosition is also the initial starting point of the trajectory path
    if(item.hasBeenMoved && currentPosition != null && currentPosition != object.oldPosition){
      var newStartNode = {x:0, y:0, z:0};
      newStartNode.x = currentPosition.x + (object.oldPosition.x - object.lastPathPosition.x);
      newStartNode.y = currentPosition.y + (object.oldPosition.y - object.lastPathPosition.y );
      newStartNode.z = currentPosition.z + (object.oldPosition.z - object.lastPathPosition.z);

      delX = newStartNode.x - object.oldPosition.x
      delY = newStartNode.y - object.oldPosition.y;
      delZ = newStartNode.z - object.oldPosition.z;

      item.oldPosition.copy(newStartNode);
    }

    this.path.points = soundTrajectory.splinePoints.map(i => new THREE.Vector3(i.x + delX, i.y + delY, i.z + delZ));
    this.path.parentObject = object;
    var newTrajectory = this.path.createObject(this, true, true);
    this.soundTrajectories.push(newTrajectory);
    this.changeTrajectoryLocation(newTrajectory, soundTrajectory);
    if(item.hasBeenMoved){
      //this.changeTrajectoryLocation(newTrajectory, soundTrajectory);
      this.changeUndoRedoActions(object.containerObject.uuid, 'trajectoryPos', soundTrajectory);
      item.hasBeenMoved = false;
    } else {
      object.containerObject.position.copy(object.lastPathPosition);
      item.containerObject.position.copy(object.lastPathPosition);
    }
    object.calculateMovementSpeed();
  }

  addSoundObject(soundObject, flag = true, trajectory = soundObject.trajectory){
    soundObject.restoreToScene(this.scene);
    this.soundObjects.push(soundObject);
    if(trajectory){
      if(flag == true){
        this.addSoundTrajectory(trajectory,soundObject);
      } else if (flag == "combo" || flag == false){
        this.addSoundTrajectory(trajectory,soundObject, false);
      }
    }
  }

  addSoundZone(soundZone){
    soundZone.restoreToScene(this.scene);
    this.soundZones.push(soundZone)
  }

  addCone(object, cone, flag = true){
    object.restoreConeToScene(cone, object.coneSounds[cone.uuid]);
  }

  undo(){
    var cannotDo = false;

    if(this.undoableActionStack.length > 0){
      let actionToUndo = this.undoableActionStack.pop();
      switch(actionToUndo.actionType){
        case 'removeSoundObject':
          if(this.doesObjectExist(actionToUndo.mainObject.containerObject.uuid, 'soundObject')){
            this.undo();
          } else {
            this.addSoundObject(actionToUndo.mainObject, false);
            this.setActiveObject(actionToUndo.mainObject);
          }
          break;
        case 'removeSoundZone':
          this.addSoundZone(actionToUndo.mainObject);
          this.setActiveObject(actionToUndo.mainObject);
          break;
        case 'addSoundObject':
          if(this.soundObjects.length > 0){
            this.removeSoundObject(actionToUndo.mainObject, false);
            this.activeObject = null;
            this.reset();
          } else {
            cannotDo = true;
          }
          break;
        case 'addSoundZone':
          this.removeSoundZone(actionToUndo.mainObject, false);
          this.activeObject = null;
          break;
        case 'removeSoundTrajectory':
          this.addSoundTrajectory(actionToUndo.mainObject, actionToUndo.mainObject.parentSoundObject, false);
          this.setActiveObject(actionToUndo.mainObject.parentSoundObject);
          actionToUndo.mainObject.parentSoundObject.trajectory.setActive();
          break;
        case 'addSoundTrajectory':
          actionToUndo.mainObject.parentSoundObject.trajectory.setInactive();
          actionToUndo.mainObject.parentSoundObject.trajectory.turnInvisible();
          this.removeSoundTrajectory(actionToUndo.mainObject, false);
          this.setActiveObject(actionToUndo.mainObject);
          break;
        case 'removeFullObject':
          this.addSoundObject(actionToUndo.mainObject, true, actionToUndo.secondary);
          this.setActiveObject(actionToUndo.mainObject);
          if(actionToUndo.mainObject.trajectory){
            actionToUndo.mainObject.trajectory.setActive();
          }
          break;
        case 'addFullObject':
          this.removeSoundObject(actionToUndo.mainObject, "comboUndoRedo");
          this.activeObject = null;
          this.reset();
          break;
        case 'addCone':
          this.removeCone(actionToUndo.mainObject, actionToUndo.secondary, false);
          this.setActiveObject(actionToUndo.mainObject);
          break;
        case 'removeCone':
          this.addCone(actionToUndo.mainObject, actionToUndo.secondary, false);
          break;
        default:
          console.log('no such action type exists for type ', actionToUndo.actionType);
          break;
      }
      if(!cannotDo){
        this.redoableActionStack.push(actionToUndo);
      } else {
        this.undo();
      }
    } else {
      console.log('nothing to undo');
    }
  }

  redo(){
    var cannotDo = false;

    if(this.redoableActionStack.length > 0){
      let actionToDo = this.redoableActionStack.pop();
      switch(actionToDo.actionType){
        case 'addSoundObject':
          this.addSoundObject(actionToDo.mainObject, false);
          this.setActiveObject(actionToDo.mainObject);
          break;
        case 'addSoundZone':
          this.addSoundZone(actionToDo.mainObject);
          this.setActiveObject(actionToDo.mainObject);
          break;
        case 'removeSoundObject':
          if(!this.doesObjectExist(actionToDo.mainObject.containerObject.uuid, 'soundObject')){
            cannotDo = true;
          } else {
            this.removeSoundObject(actionToDo.mainObject, false);
            this.activeObject = null;
            this.reset();
          }
          break;
        case 'removeSoundZone':
          this.removeSoundZone(actionToDo.mainObject, false);
          this.activeObject = null;
          break;
        case 'removeSoundTrajectory':
          if(actionToDo.mainObject.parentSoundObject.trajectory == null){
            cannotDo = true;
          } else {
            actionToDo.mainObject.parentSoundObject.trajectory.setInactive();
            actionToDo.mainObject.parentSoundObject.trajectory.turnInvisible();
            this.removeSoundTrajectory(actionToDo.mainObject, false);
            this.setActiveObject(actionToDo.mainObject);
          }
          break;
        case 'addSoundTrajectory':
          this.addSoundTrajectory(actionToDo.mainObject, actionToDo.mainObject.parentSoundObject, false);
          this.setActiveObject(actionToDo.mainObject.parentSoundObject);
          actionToDo.mainObject.parentSoundObject.trajectory.setActive();
          break;
        case 'removeFullObject':
          if(!this.doesObjectExist(actionToDo.mainObject.containerObject.uuid, 'soundObject')){
            cannotDo = true;
          } else {
            this.removeSoundObject(actionToDo.mainObject, "combo");
            this.activeObject = null;
            this.reset();
          }
          break;
        case 'addFullObject':
          this.addSoundObject(actionToDo.mainObject, false, actionToDo.secondary);
          this.setActiveObject(actionToDo.mainObject);
          break;
        case 'addCone':
          this.addCone(actionToDo.mainObject, actionToDo.secondary, false);
          break;
        case 'removeCone':
          if(actionToDo.mainObject == null && actionToDo.secondary == null){
            cannotDo = true;
          } else {
            this.removeCone(actionToDo.mainObject, actionToDo.secondary, false);
            this.setActiveObject(actionToDo.mainObject);
          }
          break;
        default:
          console.log('no such action type exists for type ', actionToDo.actionType);
          break;
      }
      if(!cannotDo){
        this.undoableActionStack.push(actionToDo);
      } else {
        this.redo();
      }
    } else {
      console.log("nothing to redo");
    }

  }

  clear(){
    let deleteEvent = new KeyboardEvent('keydown',{
      "bubbles": true,
      "cancelable": true,
      "key": "Backspace",
      "code": "Backspace",
      "keyCode": 8,
    });
    // delete all soundObjects
    let counter = this.soundObjects.length - 1;
    while(this.soundObjects.length != 0){
      this.activeObject = this.soundObjects[counter];
      document.activeElement.dispatchEvent(deleteEvent);
      counter -= 1;
    }
    // delete all soundZones
    counter = this.soundZones.length - 1;
    while(this.soundZones.length != 0){
      this.activeObject = this.soundZones[counter];
      document.activeElement.dispatchEvent(deleteEvent);
      counter -= 1;
    }

    // delete head trajectory
    if(this.headObject.trajectory != null){
      this.removeSoundTrajectory(this.headObject.trajectory);
    }
  }

  reattachConeSound(cone, sound){
    cone.sound = sound;
  }

  copySelectedItem() {
    this.reset();
    // function to make a copy of a sound object or sound zone
    if (this.activeObject) {
      if (this.activeObject.type == "SoundObject") {
        var index = this.soundObjects.indexOf(this.activeObject);
        var originalObj = this.soundObjects[index]

        // Copy sound Object and Cones
        let newObj = this.path.createObject(this, true);
        newObj.copyObject(originalObj, this.mouse);
        this.setActiveObject(newObj);

        this.isAddingObject = false;

        // Stick sound object to mouse and set down at mouse click point
        this._moveObject = this.moveObject.bind(this);
        this._placeObject = this.placeObject.bind(this, originalObj);
        document.addEventListener('mousemove', this._moveObject, false);
        document.addEventListener('mousedown', this._placeObject, false);
      }
      else if (this.activeObject.type == "SoundZone") {
        var index = this.soundZones.indexOf(this.activeObject);
        var originalObj = this.soundZones[index];

        // Fakes drawing for zone creation
        this.path.points = originalObj.splinePoints;

        // Copy sound zone
        let newObj = this.path.createObject(this, true);
        newObj.copyObject(originalObj, this.mouse);

        this.setActiveObject(newObj);
        this.isAddingObject = false;
        this.activeObject.updateZone();

        // Stick sound object to mouse and set down at mouse click point
        this._moveObject = this.moveObject.bind(this);
        this._placeObject = this.placeObject.bind(this, originalObj);
        document.addEventListener('mousemove', this._moveObject, false);
        document.addEventListener('mousedown', this._placeObject, false);
        this.soundZones.push(newObj);
      }
    }
  }

  moveObject() {
    // function to stick copied object to mouse
    if (this.activeObject) {
      this.activeObject.move(this, false);
    }
  }

  placeObject(originalObj) {
    // function to set copied object down at mouse click point
    document.removeEventListener('mousemove', this._moveObject, false);
    document.removeEventListener('mousedown', this._placeObject, false);

    // Copy and position soundobject trajectory
    if (this.activeObject.type == "SoundObject" && originalObj.trajectory) {
      this.path.points = originalObj.trajectory.splinePoints.map(i => new THREE.Vector3(i.x, i.y, i.z));
      this.path.parentObject = this.activeObject;
      this.path.createObject(this, true);
      this.activeObject.trajectory.setCopyPosition(this.mouse);
      this.activeObject.calculateMovementSpeed();
    }
  }

  findObject(uuid, type){
    if(type === 'soundObject'){
      for(var i = 0; i < this.soundObjects.length; i++){
        if(this.soundObjects[i].containerObject.uuid == uuid){
          return this.soundObjects[i];
        }
      }
    }
    return null;
  }

  doesObjectExist(uuid, type){
    if(type === 'soundObject'){
      for(var i = 0; i < this.soundObjects.length; i++){
        if(this.soundObjects[i].containerObject.uuid == uuid){
          return true;
        }
      }
    }
    return false;
  }

  changeUndoRedoActions(uuid, change, object){
    if(change === 'trajectoryPos'){
      this.undoableActionStack.forEach( function(action){
        if((action.actionType == 'removeSoundTrajectory' || action.actionType == 'addSoundTrajectory')
          && action.mainObject.parentSoundObject.containerObject.uuid == uuid){
          action.mainObject = object;
          action.mainObject.parentSoundObject.trajectory = action.mainObject;
        }
      });

      this.redoableActionStack.forEach( function(action){
        if((action.actionType == 'removeSoundTrajectory' || action.actionType == 'addSoundTrajectory')
          && action.mainObject.parentSoundObject.containerObject.uuid == uuid){
          action.mainObject = object;
          action.mainObject.parentSoundObject.trajectory = action.mainObject;
        }
      });

    }
    //else if(change === 'trajectoryHead'){}
  }

  changeTrajectoryLocation(newTrajectory, oldTrajectory){
    Object.assign(oldTrajectory.pointObjects, newTrajectory.pointObjects);
    Object.assign(oldTrajectory.points, newTrajectory.points);
    Object.assign(oldTrajectory.spline, newTrajectory.spline);
    Object.assign(oldTrajectory.splinePoints, newTrajectory.splinePoints);
  }

  areTrajectoryPointsEqual(newTrajectory, oldTrajectory){
    if(newTrajectory.length != oldTrajectory.length){
      return false;
    } else {
      for(var i = 0; i < newTrajectory.length; i++){
        if((newTrajectory[i].x != oldTrajectory[i].x) ||
           (newTrajectory[i].y != oldTrajectory[i].y) ||
           (newTrajectory[i].z != oldTrajectory[i].z)) {
             return false;
           }
      }
    }
    return true;
  }

  /**
  overrides three.js triangulate with libtess.js algorithm for the conversion of a curve to a filled (2D) path. still doesn't produce desired behavior with some non-simple paths

  adapted from libtess example page https://brendankenny.github.io/libtess.js/examples/simple_triangulation/index.html
  */
  overrideTriangulate() {
    var tessy = (function initTesselator() {
      // function called for each vertex of tesselator output
      function vertexCallback(data, polyVertArray) {
        polyVertArray[polyVertArray.length] = data[0];
        polyVertArray[polyVertArray.length] = data[1];
      }
      function begincallback(type) {
        if (type !== libtess.primitiveType.GL_TRIANGLES) {
          console.log('expected TRIANGLES but got type: ' + type);
        }
      }
      function errorcallback(errno) {
        console.log('error callback');
        console.log('error number: ' + errno);
      }
      // callback for when segments intersect and must be split
      function combinecallback(coords, data, weight) {
        return [coords[0], coords[1], coords[2]];
      }
      function edgeCallback(flag) {
        // don't really care about the flag, but need no-strip/no-fan behavior
        // console.log('edge flag: ' + flag);
      }

      var tessy = new libtess.GluTesselator();
      tessy.gluTessProperty(libtess.gluEnum.GLU_TESS_WINDING_RULE, libtess.windingRule.GLU_TESS_WINDING_NONZERO);
      tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
      tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
      tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
      tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
      tessy.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

      return tessy;
    })();

    THREE.ShapeUtils.triangulate = function ( contour, indices ) {

      if ( contour.length < 3 ) return null;

      var triangles = [];
      var map = {};

      var result = [];
      var vertIndices = [];

      // libtess will take 3d verts and flatten to a plane for tesselation
      // since only doing 2d tesselation here, provide z=1 normal to skip
      // iterating over verts only to get the same answer.
      // comment out to test normal-generation code
      tessy.gluTessNormal(0, 0, 1);

      tessy.gluTessBeginPolygon(triangles);

      // shape should be a single contour without holes anyway...
      tessy.gluTessBeginContour();
      contour.forEach((pt, i) => {
        var coord = [pt.x, pt.y, 0];
        tessy.gluTessVertex(coord, coord);
        map[coord[0] + ',' + coord[1]] = i; // store in map
      })
      tessy.gluTessEndContour();

      // finish polygon
      tessy.gluTessEndPolygon();

      // use map to convert points back to triangles of contour
      var nTri = triangles.length;

      for (var i = 0; i < nTri; i+=6) {
        var a = map[ triangles[i] + ',' + triangles[i+1] ],
          b = map[ triangles[i+2] + ',' + triangles[i+3] ],
          c = map[ triangles[i+4] + ',' + triangles[i+5] ];

        if (a == undefined || b == undefined || c == undefined) {continue;}
        vertIndices.push([a, b, c]);
        result.push( [ contour[ a ],
          contour[ b ],
          contour[ c ] ] );
      }

      if ( indices ) return vertIndices;
      return result;
    };
  }

  export() {
    const zipHelper = this.zipHelper;
    const that = this;

    document.getElementById('save-status').style.display = 'block';
    document.getElementById('save').style.pointerEvents = 'none';
    document.getElementById('save').style.opacity = "0.5";

    let promise = new Promise(function(resolve, reject) {
      var files = [];

      const addFile = (file) => {
        const fileExists = files.map(f => f.name).includes(file.name);
        if (!fileExists) files.push(file);
      };

      const exportJSON = JSON.stringify({
        camera: that.camera.threeCamera.toJSON(),
        soundObjects: that.soundObjects.map((obj) => {
          if (obj.file) addFile(obj.file);

          obj.cones.forEach((c) => {
            if (c.file) addFile(c.file);
          });

          return obj.toJSON();
        }),
        soundZones: that.soundZones.map((obj) => {
          if (obj.file) addFile(obj.file);
          return obj.toJSON();
        }),
        headObject: [that.headObject.toJSON()],
      }, null, 2);

      const configBlob = new Blob([exportJSON], {type: 'application/json'});
      const configFile = new File([configBlob], 'config.json');
      let exportFiles = files.concat([configFile]);

      zipHelper.addFiles(
        exportFiles,
        function() {},
        function(file) {},
        function(current, total) {},
        function() {
          zipHelper.getBlobURL(function(blobURL) {
            resolve(blobURL);
          });
        },
      );
    });

    return promise;
  }

  import(data) {
    const zipHelper = this.zipHelper;
    var files = {};
    var promises = [];

    document.getElementById('load-status').style.display = 'block';
    document.getElementById('load').style.pointerEvents = 'none';
    document.getElementById('load').style.opacity = "0.5";

    zipHelper.getEntries(data, (entries) => {
      promises = entries.map(function(entry) {
        return new Promise(function(resolve, reject) {
          zipHelper.getEntryFile(entry, function(filename, blob) {
              var fileReader = new FileReader();
              var fl = {};

              fileReader.onload = function() {
                if (filename === 'config.json') {
                  fl[filename] = fileReader.result;
                } else {
                  fl[filename] = new File([fileReader.result], filename);
                }

                resolve(fl);
              };

              if (filename === 'config.json') {
                fileReader.readAsText(blob);
              } else {
                fileReader.readAsArrayBuffer(blob);
              }

          }, function(current, total) {

          });
        });
      });

      Promise.all(promises).then((resolvedFiles) => {
        const importedData = Object.assign(...resolvedFiles);
        const config = importedData['config.json'];

        if (!config) {
          alert('no config');
          document.getElementById('load-status').style.display = 'none';
          document.getElementById('load').style.pointerEvents = 'auto';
          document.getElementById('load').style.opacity = "1";
          return;
        }

        let json = JSON.parse(config);
        let loader = new THREE.ObjectLoader();
        const cam = loader.parse(json.camera);

        json.soundObjects.forEach(obj => {
          let parsed = JSON.parse(obj);

          let newObj = this.path.createObject(this, true);
          newObj.fromJSON(obj, importedData);
          this.setActiveObject(newObj);
          this.isAddingObject = false;

          // Trajectory
          if (parsed.trajectory) {
            this.path.points = parsed.trajectory.map(i => new THREE.Vector3(i.x, i.y, i.z));
            this.path.parentObject = newObj;
            this.path.createObject(this, true);
            newObj.calculateMovementSpeed();
          }
        });

        json.soundZones.forEach(obj => {
          var object = JSON.parse(obj);

          // Fakes drawing for zone creation
          this.path.points = object.points;

          let newObj = this.path.createObject(this, true);
          newObj.fromJSON(obj, importedData);

          this.setActiveObject(newObj);
          this.isAddingObject = false;
        });

        json.headObject.forEach(obj => {
          let parsed = JSON.parse(obj);
          this.setActiveObject(this.headObject);

          // Clear previous head trajectory
          this.headObject.clear();

          // Create new head object
          this.headObject = new HeadObject(this);
          this.headObject.fromJSON(obj, importedData);
          this.setActiveObject(this.headObject);
          this.isAddingObject = false;

          // Trajectory
          if (parsed.trajectory) {
            this.path.points = parsed.trajectory.map(i => new THREE.Vector3(i.x, i.y, i.z));
            this.path.parentObject = this.headObject;
            this.path.createObject(this, true);
            this.headObject.calculateMovementSpeed();
          }
        });

        this.setActiveObject(null);
        this.camera.threeCamera.copy(cam);
        this.camera.threeCamera.updateProjectionMatrix();

        document.getElementById('load-status').style.display = 'none';
        document.getElementById('load').style.pointerEvents = 'auto';
        document.getElementById('load').style.opacity = "1";
      }
    );
    });
  }
}
