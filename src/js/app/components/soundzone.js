import * as THREE from 'three';
import 'whatwg-fetch';
import Helpers from '../../utils/helpers';

export default class SoundZone {
  constructor(main, points, copyZone = false) {
    this.type = 'SoundZone';
    this.isActive = true;
    this.audio = main.audio;
    this.app = main;

    this.stoRef = main.stoRef;
    this.dbRef = main.dbRef;
    this.roomCode = main.roomCode;

    this.mouse = main.mouse;
    this.scene = main.scene;

    this.points = points;
    this.splinePoints = points;

    this.pointObjects;
    this.spline;
    this.shape;

    this.sound = null;
    this.prevSound = null;
    this.file = null;
    this.filename = null;

    this.zoneScale = 1;
    this.isMuted = main.isMuted;
    this.loaded = false;
    this.isPlaying = false;
    this.isChangingAudioTime = false;
    this.selectedPoint;
    this.mouseOffsetX = 0, this.mouseOffsetY = 0;
    this.volume = null;
    this.isInZone = false;
    this.userSetPlay = this.app.isPlaying;
    this.isAddingSound = false;
    this.cache = {};
    this.oldVolume = -1;

    this.containerObject = new THREE.Group();
    this.cursor = new THREE.Mesh(
      new THREE.SphereGeometry(15),
      new THREE.MeshBasicMaterial({
        color: 0xff1169,
        transparent: true,
        opacity: 0.5
      })
    );
    this.cursor.visible = false;
    this.containerObject.add(this.cursor);

    this.isInitialized = false;

    this.renderPath();
    if(this.roomCode != null){
        this.headKey = main.headKey.key;
        this.zoneKey = this.dbRef.child('zones').push();
        this.containerObject.name = this.zoneKey.key;
    }
    if(copyZone){
      this.containerObject.name = copyZone;
    }
  }

  updateFirebaseDetails(dbRef, stoRef, headKey, roomCode){
    this.headKey = headKey.key;
    this.stoRef = stoRef;
    this.dbRef = dbRef;
    this.roomCode = roomCode;
    let zoneKey = this.dbRef.child('zones').push();
    this.containerObject.name = zoneKey.key;
    zoneKey.set({
      position: this.containerObject.position,
      type: this.type, 
      zone: this.splinePoints,
      sound: null,
      volume: this.volume,
      scale: this.zoneScale,
      rotation: this.containerObject.rotation.y,
      lastEdit: this.headKey
    })

    if(this.file){
        this.uploadFirebaseSound(this.file);
    }
  }

  underUser(audio) {
    if (this.sound && this.loaded && this.userSetPlay) {
      // Starts playing if user is in zone, sound is not yet playing, and global play is on
      if(!this.isInZone && this.isPlaying){
        this.sound.source.stop();
        this.sound.state.pausedAt = (Date.now() - this.sound.state.startedAt) % (Math.floor(this.sound.state.duration) * 1000);
        this.isPlaying = false;
      }
      if(!this.isPlaying){
        this.sound.source = audio.context.createBufferSource();
        this.sound.source.buffer = this.sound.buffer;
        this.sound.source.loop = true;
        this.sound.source.volume = audio.context.createGain();
        this.sound.source.volume.gain.value = this.volume;
        this.sound.source.connect(this.sound.source.volume);
        this.sound.source.volume.connect(this.sound.volume);
        let resumeTime = this.sound.state.pausedAt;
        this.sound.state.isAudioPaused = false;
        resumeTime /= 1000;
        this.sound.state.startedAt = Date.now() - this.sound.state.pausedAt;
        this.sound.source.start(audio.context.currentTime, resumeTime);
        this.sound.volume.gain.setTargetAtTime(1.0, audio.context.currentTime + 0.1, 0.1);
        }
        this.isPlaying = true;
    }
    else if (this.sound && this.isPlaying && this.loaded && !this.userSetPlay) {
      // Stops playing if user is in zone, sound is playing, and global pause is on or users pauses sound
      this.stopSound();
    }
    this.isInZone = true;
  }

  notUnderUser(audio, isRender = false) {
    if (this.sound && this.loaded && this.isPlaying) {
            this.sound.volume.gain.setTargetAtTime(0.0, audio.context.currentTime, 0.1);
            this.sound.source.stop(audio.context.currentTime + 0.1);
            if(!isRender){
                this.sound.state.pausedAt = (Date.now() - this.sound.state.startedAt) % (Math.floor(this.sound.state.duration) * 1000);
                this.sound.state.isAudioPaused = true;
                this.isPlaying = false;
                // sound is still running but is not audibly heard
            }
    }
    this.isInZone = false;
  }

  // remove sound file
  clear() {
    // stop audio stream if currently playing
    if (this.isPlaying) {
      this.sound.source.stop();
    }
    if (this.sound && this.sound.state) {
      this.sound.state.clear();
      this.volume = null;
    }
    this.isPlaying = false;
    this.loaded = false;
    this.mainMixer = null;
    this.sound = null;
  }

  uploadFirebaseSound(file){
    let id = this.containerObject.name;
    let tempDbRef = this.dbRef;
    let headKey = this.headKey;
    let audioState = this.sound != null ? !this.sound.state.isAudioPaused : this.app.isPlaying;
    this.isAddingSound = true;
    let self = this;
    console.log("uploading sound to firebase", headKey, this.headKey);
    let upload = this.stoRef.child('zones' + '/' + id + '/' + file.name).put(file);
    upload.on('state_changed', function(snapshot){
      var progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      console.log('Upload is ' + progress + '% done');
    }, function(error){
      console.log('Problem uploading file');
    }, function(){
      let properties = {
          prev: self.cache.hasOwnProperty('prev') ? self.cache.prev : null,
        }
      tempDbRef.child('zones').child(id).update({
        sound: file.name,
        volume: self.sound == null ? 1 : self.volume,
        lastEdit: headKey,
        isPlaying: audioState,
        scale: self.zoneScale,
        rotation: self.containerObject.rotation.y,
        prev: properties.prev
      });
      self.isAddingSound = false;
      self.cache = {};
      
    });
  }

  loadSound(file, audio, mute, copy = false) {
    const context = audio.context;
    let reader = new FileReader();

    this.filename = file.name;
    this.file = file;
    this.volume = 0.5;
    let that = this;

    console.log("loading ", file.name);
    if(!copy && this.roomCode != null){
     this.uploadFirebaseSound(file);
    }
    let promise = new Promise(function(resolve, reject) {
        reader.onload = (ev) => {
        context.decodeAudioData(ev.target.result, function(decodedData) {
            that.clear();
            if(that.sound == null){
                that.sound = {};
            
            that.sound.state = {}
            that.sound.state.startedAt = Date.now();
            that.sound.state.pausedAt = 0;
            that.sound.state.currentTime = 0;
            that.sound.state.isAudioPaused = false;
            that.sound.state.duration = 0;

            that.sound.state.clear = () => {
                that.sound.state.startedAt = that.sound.state.pausedAt = that.sound.state.currentTime = that.sound.state.duration = 0;
                that.sound.state.isAudioPaused = true;
            }


            that.sound.name = file.name;
            that.sound.source = context.createBufferSource();
            that.sound.source.buffer = decodedData;
            that.mainMixer = context.createGain();
            that.sound.volume = context.createGain();
            that.sound.source.volume = context.createGain();
            that.sound.source.connect(that.sound.source.volume);
            that.sound.source.volume.connect(that.sound.volume);
            that.sound.volume.connect(that.mainMixer);
            that.mainMixer.connect(audio.destination);
            that.mainMixer.gain.value = mute ? 0 : 1;
            that.sound.volume.gain.value = that.volume;
            that.sound.buffer = decodedData;
            that.sound.state.duration = that.sound.buffer.duration;
            that.loaded = true;
            resolve(that.sound);
        };
        });
        };
        reader.readAsArrayBuffer(file);
    });

    return promise;
  }

  playSound(userToggled = false) {
    if (this.sound && this.sound.state) {
      this.sound.state.startedAt = Date.now() - this.sound.state.pausedAt;
      this.sound.state.isAudioPaused = false;

      this.shape.material.color.setHex(0xFF1169);
      if(userToggled && this.roomCode != null){
       this.updatePlayStatus(true);
      }
    }
  }

  stopSound(userToggled = false) {
    let t = this.sound && this.sound.state;
    if (this.sound && this.sound.state) {
      this.sound.state.pausedAt = (Date.now() - this.sound.state.startedAt) % (Math.floor(this.sound.state.duration) * 1000);
      this.sound.state.isAudioPaused = true;
      this.shape.material.color.setHex(0x8F8F8F);

      // TODO: investigate this wrt flickering
      this.notUnderUser(this.audio);
      if(userToggled && this.roomCode != null){
        this.updatePlayStatus(false);
       }
    }
  }

  renderPath(args) {
    // splinePoints control the curve of the path
    const points = this.splinePoints;
    // setup
    const sphere = new THREE.SphereGeometry(10);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff1169 });

    const collider = new THREE.SphereGeometry(15);
    const colliderMat = new THREE.MeshBasicMaterial({
      color: 0xff1169,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const colliderMesh = new THREE.Mesh(collider, colliderMat);

    if (!this.isInitialized) {
      this.pointObjects = [];
      // place a meshgroup at each point in array
      points.forEach((point) => {
        const sphereMesh = new THREE.Mesh(sphere, sphereMat.clone());
        const group = new THREE.Object3D();

        group.add(sphereMesh, colliderMesh.clone());
        group.position.copy(point);

        this.pointObjects.push(group);
      });
      this.splinePoints = this.pointObjects.map( pt => pt.position );
    }
    else if (args != null && args.updateType) {
      if (args.updateType === "delete") {
        let splicedPoint = this.pointObjects.splice(args.index, 1);
        this.containerObject.remove(splicedPoint[0], true);
      }
      else if (args.updateType === "add") {
        let insertedPoint = new THREE.Object3D();
        insertedPoint.add(
          new THREE.Mesh(sphere, sphereMat.clone()),
          colliderMesh.clone()
        );
        insertedPoint.position.copy(this.splinePoints[args.index]);
        this.pointObjects.splice(args.index, 0, insertedPoint);
        this.containerObject.add(insertedPoint);
      }
      this.splinePoints = this.pointObjects.map( pt => pt.position );
    }
    this.spline = new THREE.CatmullRomCurve3(this.splinePoints);
    this.spline.type = 'centripetal';
    this.spline.closed = true;

    const geometry = new THREE.BufferGeometry().setFromPoints(this.spline.getPoints(200))
    let material = new THREE.LineBasicMaterial({
      color: 0xff1169,
      linewidth: 5,
      transparent: true,
      opacity: 0.4,
    });

    this.spline.mesh = new THREE.Line(geometry, material);

    // fill the path
    const rotatedPoints = this.spline.getPoints(200);
    rotatedPoints.forEach((vertex) => {
        vertex.y = vertex.z;
        vertex.z = 0.0;
    })
    //const shapeFill = new THREE.Shape(rotatedPoints);
    const shapeFill = new THREE.Shape(rotatedPoints);
    // shapeFill.fromPoints(rotatedPoints);
    const shapeGeometry = new THREE.ShapeGeometry(shapeFill);
    shapeGeometry.rotateX(Math.PI / 2);

    var opacityIntensity = this.volume;
    if (!this.volume) {
      opacityIntensity = 0.5;
    }

    var materialColor = this.userSetPlay ? 0xFF1169 : 0x8F8F8F;
    material = new THREE.MeshLambertMaterial({
      color: materialColor,
      transparent: true,
      opacity: Helpers.mapRange(opacityIntensity, 0, 2, 0.05, 0.35),
      side: THREE.BackSide,
      premultipliedAlpha: true,
      depthWrite: false
    });
    this.shape = new THREE.Mesh(shapeGeometry, material);
  }

  get objects() {
    return [].concat(this.pointObjects, this.spline.mesh, this.shape);
  }

  addToScene(scene, pos = false) {
    if (!this.isInitialized) {
      this.isInitialized = true;
      var box = new THREE.Box3().setFromObject( this.shape );
      box.getCenter( this.containerObject.position );
      scene.add(this.containerObject);
      this.objects.forEach((obj) => {
        obj.translateX(-this.containerObject.position.x);
        obj.translateZ(-this.containerObject.position.z);
        this.containerObject.add(obj);
      });

      if(!pos && this.roomCode != null){
        this.zoneKey.set({
          position: this.containerObject.position,
          type: this.type, 
          zone: this.splinePoints,
          sound: null,
          volume: null,
          scale: 1,
          rotation: this.containerObject.rotation.y,
          lastEdit: this.headKey
        })
      } else if(pos){
        this.containerObject.position.copy(
          new THREE.Vector3(pos.x, pos.y, pos.z)
        );
      }
      
    }
    else {
      if(pos){
        this.containerObject.position.copy(
          new THREE.Vector3(pos.x, pos.y, pos.z)
        );
      }
      this.containerObject.add(this.shape);
      this.containerObject.add(this.spline.mesh);
    }
  }

  removeFromScene(scene) {
    if(this.sound){
      this.prevSound = new Object();
      Object.assign(this.prevSound, this.sound);
    }
    scene.remove(this.containerObject, true);
    if(this.roomCode != null){
      this.dbRef.child('zones').child(this.containerObject.name).remove();
    }
  }

  restoreToScene(scene){
    this.sound = this.prevSound;
    this.scene.add(this.containerObject);
  }

  updateZoneScale(prevScale, delayUpdate = false) {
    for (var i = 0; i < this.splinePoints.length; i++) {
      this.splinePoints[i].x = (this.splinePoints[i].x / prevScale) * this.zoneScale;
      this.splinePoints[i].z = (this.splinePoints[i].z / prevScale) * this.zoneScale;
    }
    if(!delayUpdate){
      this.updateZone({updateType: 'update'});
    } 
  }

  updatePointObjects(point = null){
    if(point){
      
    } else {
      for(let i = 0; i < this.splinePoints.length; ++i){
        this.pointObjects[i].position.x = this.splinePoints[i].x;
        this.pointObjects[i].position.z = this.splinePoints[i].z;
      }
    }
  }

  copyObject(object, position) {
    this.containerObject.position.copy(position);
    this.containerObject.rotation.y = object.containerObject.rotation.y;
    this.zoneScale = object.zoneScale;

    if (object.file) {
      this.loadSound(object.file, this.audio, this.app.isMuted);
      const volume = Math.max(Math.min(object.volume, 2), 0.0);
      this.shape.material.opacity = Helpers.mapRange(volume, 0, 2, 0.05, 0.35);

      this.volume = volume;
      if (this.sound && this.sound.source) {
        this.sound.source.volume.gain.value = volume;
        // this.sound.source.volume = volume;
        this.sound.volume.gain.value = volume;
      }

      this.userSetPlay = object.userSetPlay;
      if (object.sound.state.isAudioPaused) {
        this.stopSound();
      }
    }
    //this.app.soundZones.push(object);

  }

  copySound(file, volume, isPlaying = true, setVolume = true){
    this.loadSound(file, this.audio, this.app.isMuted, true).then(() => {
        if(setVolume){
            this.volume = Math.max(Math.min(volume, 2), 0.0);
        }

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

  // raycast to this soundzone
  isUnderMouse(raycaster) {
    if (this.isActive) {
      return raycaster.intersectObjects(this.objects).length > 0;
    }

    return raycaster.intersectObject(this.shape).length > 0;
  }

  objectUnderMouse(raycaster) {
    const intersects = raycaster.intersectObjects(this.objects, true);
    if (intersects.length > 0) {
      if (intersects[0].object.type === 'Line' || intersects[0].object === this.shape) {
        return intersects[Math.floor(intersects.length / 2)];
      }

      return intersects[0];
    }

    return null;
  }

  hideCursor() {
    this.cursor.visible = false;
  }

  showCursor(object, point) {
    if (object !== this.shape) {
      this.cursor.visible = true;
      if (object === this.spline.mesh) {
        const minv = new THREE.Matrix4();
        minv.copy(this.containerObject.matrix);
        minv.invert();
        this.cursor.position.copy(point.applyMatrix4(minv));
      }
      else {
        this.cursor.position.copy(object.parent.position);
      }
    }
    else {
      this.hideCursor();
    }
  }

  setMouseOffset(point) {
    this.mouseOffsetX = point.x;
    this.mouseOffsetY = point.z;
  }

  updateZone(args = null, copy = false) {
    const scene = this.spline.mesh.parent;
    this.containerObject.remove(this.spline.mesh, true);
    this.containerObject.remove(this.shape, true);
    this.renderPath(args);
    this.addToScene(scene);
    if(!copy && this.roomCode != null){
        this.dbRef.child('zones').child(this.containerObject.name).update({
            zone: this.splinePoints,
            lastEdit: this.headKey
        });
    }
  }

  move(main) {
    // if (!main.perspectiveView) {
      const dx = main.mouse.x - this.mouseOffsetX;
      const dy = main.mouse.z - this.mouseOffsetY;
      this.mouseOffsetX = main.mouse.x;
      this.mouseOffsetY = main.mouse.z;
      this.hideCursor();

      if (this.selectedPoint) {
        // move selected point
        const minv = new THREE.Matrix4();
        minv.copy(this.containerObject.matrix);
        minv.invert();
        this.selectedPoint.position.copy(main.mouse.applyMatrix4(minv));
        this.updateZone({updateType: 'update'});
      } else {
        // move entire shape
        this.containerObject.position.x += dx;
        this.containerObject.position.z += dy;
        if(this.roomCode != null){
          this.dbRef.child('zones').child(this.containerObject.name).update({
            position: this.containerObject.position,
            lastEdit: this.headKey
          });
        }
      }
    // }
  }

  setActive(main) {
    this.setMouseOffset(main.mouse);
    this.isActive = true;
    this.pointObjects.forEach(obj => (obj.visible = true));
    this.spline.mesh.visible = true;
  }

  setInactive() {
    this.hideCursor();
    this.deselectPoint();
    this.isActive = false;
    this.pointObjects.forEach(obj => (obj.visible = false));
    this.spline.mesh.visible = false;
  }

  select(intersect) {
    if (!intersect) return;

    // obj can be the curve, a spline point, or the shape mesh
    const obj = intersect.object;

    if (obj.type === 'Line') {
      // add a point to the line
      this.addPoint(intersect.point);
    } else if (obj.parent.type === 'Object3D') {
      // select an existing point on line
      this.selectPoint(obj.parent);
    } else {
      this.deselectPoint();
      this.setMouseOffset(intersect.point);
    }
  }

  removePoint() {
    // find point in array
    const i = this.pointObjects.indexOf(this.selectedPoint);
    this.splinePoints.splice(i, 1);
    this.deselectPoint();
    this.updateZone({index: i, updateType: 'delete'});
  }

  addPoint(point) {
    const minv = new THREE.Matrix4();
    minv.copy(this.containerObject.matrix);
    minv.invert();
    const position = point.applyMatrix4(minv);

    let closestSplinePoint = 0;
    let prevDistToSplinePoint = -1;
    let minDistance = Number.MAX_VALUE;
    let minPoint = 1;

    // search for point on spline
    for (let t = 0; t < 1; t += 1 / 200.0) {
      const pt = this.spline.getPoint(t);

      const distToSplinePoint = this.splinePoints[closestSplinePoint].distanceToSquared(pt);
      if (distToSplinePoint > prevDistToSplinePoint) {
        closestSplinePoint += 1;

        if (closestSplinePoint >= this.splinePoints.length) {
          closestSplinePoint = 0;
        }
      }
      prevDistToSplinePoint = this.splinePoints[closestSplinePoint].distanceToSquared(pt);
      const distToPoint = pt.distanceToSquared(position);
      if (distToPoint < minDistance) {
        minDistance = distToPoint;
        minPoint = closestSplinePoint;
      }
    }

    this.splinePoints.splice(minPoint, 0, position);
    this.updateZone({index: minPoint, updateType: 'add'});
    this.selectPoint(this.pointObjects[minPoint]);
  }

  selectPoint(obj) {
    this.deselectPoint();
    this.selectedPoint = obj;
    obj.children[0].material.color.set('blue');
  }

  deselectPoint() {
    if (this.selectedPoint) {
      this.selectedPoint.children[0].material.color.set('red');
      this.selectedPoint = null;
    }
  }

  mute(main) {
    this.isMuted = true;
    this.checkMuteState(main);
  }

  unmute(main) {
    this.isMuted = false;
    this.checkMuteState(main);
  }

  toggleAppearance(main) {
    if (main.isPlaying) {
        this.shape.material.color.setHex(0xFF1169);
    } else {
        this.shape.material.color.setHex(0x8F8F8F);
    }
  }

  turnInvisible() {
    this.shape.material.visible = false;
    this.pointObjects.forEach((point) => {
      point.children[0].visible = false;
    });
    this.spline.mesh.material.visible = false;
  }

  updatePlayStatus(status){
    let updates = {};
    updates['isPlaying'] = status;
    updates['lastEdit'] = this.headKey;
    this.dbRef.child('zones').child(this.containerObject.name).update(updates);
  }

  checkPlayState(main) {
    if (main.isPlaying) {
      this.shape.material.color.setHex(0xFF1169);
      if(this.sound && this.sound.state.isAudioPaused){
        this.playSound(true);
        this.userSetPlay = true;
      } 
    }
    else {
      if(this.sound && !this.sound.state.isAudioPaused){
        this.stopSound(true);
        this.userSetPlay = false;
      } 
      this.shape.material.color.setHex(0x8F8F8F);
    }
  }

  checkMuteState(main) {
    if (this.mainMixer) {
      if (main.isMuted || this.isMuted) {
        this.mainMixer.gain.value = 0;
      }
      else {
        this.mainMixer.gain.value = 1;
      }
    }
  }

  toJSON() {
    const object = {
      position: this.containerObject.position,
      points: this.splinePoints,
      filename: this.filename,
      volume: this.volume
    };
    return JSON.stringify(object);
  }

  fromJSON(json, importedData) {
    const object = JSON.parse(json);
    this.containerObject.position.copy(object.position);
    let file = importedData[object.filename];
    if (file) {
      this.loadSound(file, this.audio, false);
      const volume = Math.max(Math.min(object.volume, 2), 0.0);
      this.shape.material.opacity = Helpers.mapRange(volume, 0, 2, 0.05, 0.35);
      this.volume = volume;
      if (this.sound && this.sound.source) {
        this.sound.source.volume.gain.value = volume;
      }

    }
    if(this.roomCode){

        let updates = {
            position: object.position,
            type: this.type,
            zone: this.splinePoints,
            sound: object.filename,
            volume: this.volume,
            scale: this.zoneScale,
            rotation: this.containerObject.rotation.y,
            lastEdit: this.headKey
        };
        this.dbRef.child('zones').child(this.containerObject.name).update(updates);

    }
  }
}