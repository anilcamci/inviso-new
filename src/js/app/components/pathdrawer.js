import * as THREE from 'three';
import SoundObject from './soundobject';
import SoundTrajectory from './soundtrajectory';
import SoundZone from './soundzone';
import Action from '../model/action';

export default class PathDrawer {
  constructor(scene, main) {
      this.parentObject = null;
      this.scene = scene;
      this.points = [];
      this.lines = [];
      this.lastPoint = new THREE.Vector3();
      this.isDrawing = false,

      this.material = {
        trajectory: new THREE.LineBasicMaterial({
                linewidth: 2,
                color: 0x999999
              }),
        zone: new THREE.LineBasicMaterial({
                linewidth: 5,
                color: 0xff1169
              })
      };

  }

  beginAt(point, trajectoryContainerObject) {
    this.isDrawing = true;
    this.parentObject = trajectoryContainerObject || null;
    this.lastPoint = point;
    this.points = [point];
  }

  addPoint(point) {
    if (this.isDrawing) { // redundant check? just to be safe for now
      const material = this.parentObject
                      ? this.material.trajectory
                      : this.material.zone;

      const points = [];
      points.push(this.lastPoint);
      points.push(point);
      
      // consider using line geometry for thicker line
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      
      this.lastPoint = point;
      this.points.push(point);
      this.lines.push(line);
      this.scene.add(line);
    }
  }

  createObject(main, loader = false, repeat = false, 
    currentUser = true, trajectory = null) {
    if (this.isDrawing || loader) {
      this.isDrawing = false;
      let points = trajectory;
      if(trajectory === null){
        points = simplify(this.points, 10, true);
      }
      let object;
      if (this.parentObject) {
        if (points.length >= 2) {
          object = new SoundTrajectory(main, points);
          // if (main.isUserStudyLoading) object.turnInvisible();
          object.points = points;
          this.parentObject.trajectory = object;
          object.parentSoundObject = this.parentObject;
          main.soundTrajectories.push(object);
          if (this.parentObject.type === 'SoundObject'){
          // move add-cone to appropriate position
            let guiHeight = document.getElementById('guis');
            let baseParams = document.getElementsByClassName('baseParam');
            if(guiHeight && baseParams.length > 0){
                guiHeight = guiHeight.scrollHeight;
                baseParams = baseParams[0].scrollHeight;
                if(document.getElementById('add-cone')){
                    let addButton = document.getElementById('add-cone');
                    if (addButton.style.position == "absolute") {
                        addButton.classList.add('add-cone-object-view');
                        if (main.isEditingObject) {
                            addButton.style.top = "167.5px";
                        } else {
                            addButton.style.top = "228.51px";
                        }
                    }
                }
            }
          }
          if(main.roomCode != null && currentUser){
            if(this.parentObject.type === 'SoundObject'){
              main.dbRef.child('objects').child(this.parentObject.containerObject.name).update({
                trajectory: points,
              });
            } else { // head trajectory
                main.dbRef.child('users').child(main.headKey.key).update({
                  trajectory: points,
                });
            }
          }
          if(!repeat){
            main.undoableActionStack.push(new Action(object, 'addSoundTrajectory'));
          }
        }
      }
      else {
        if (points.length >= 3) {
          object = new SoundZone(main, points);
          // if (main.isUserStudyLoading) object.turnInvisible();
          object.checkPlayState(main);
          main.soundZones.push(object);
          if(main.roomCode == null){
            main.undoableActionStack.push(new Action(object, 'addSoundZone'));  
          } 
        } else {
          object = new SoundObject(main);
          // if (main.isUserStudyLoading) object.turnInvisible();
          object.checkPlayState(main);
          main.soundObjects.push(object);
          if(main.roomCode == null){
            main.undoableActionStack.push(new Action(object, 'addSoundObject'));
          }
        }
      }

      this.clear();

      if (object) {
        console.log("adding to scene");
        object.addToScene(this.scene);
      }
      return object;
    }
    else {
      console.log('called createObject when not drawing')
    }
  }

  clear() {
    this.parentObject = null;
    this.lines.forEach((line) => {
      this.scene.remove(line);
    });
    this.lines = [];
    this.points = [];
  }
}
