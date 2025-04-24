import * as THREE from 'three';
import Keyboard from '../../utils/keyboard';
import Config from '../../data/config';
import Action from '../model/action';
import SoundObject from '../components/soundobject';
import SoundZone from '../components/soundzone';

// Manages all input interactions
export default class Interaction {
  constructor(main, renderer, scene, camera, controls) {
    // Firebase
    this.stoRef = main.stoRef;
    this.dbRef = main.dbRef;
    this.roomCode = main.roomCode;

    // Properties
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.timeout = null;
    this.tooltipTimeout = null; 

    // Instantiate keyboard helper
    this.keyboard = new Keyboard();

    // Listeners
    // Mouse events

    this.renderer.domElement.addEventListener('mousemove', event => this.onMouseMove(main, event), false);
    this.renderer.domElement.addEventListener('mouseleave', event => this.onMouseUp(main, event, false), false);
    this.renderer.domElement.addEventListener('mouseover', event => this.onMouseOver(event), false);
    this.renderer.domElement.addEventListener('mouseup', event => this.onMouseUp(main, event, true), false);
    this.renderer.domElement.addEventListener('mousedown', event => this.onMouseDown(main, event), false);

    this.roomInput = document.getElementById('splashscreen');

    this.pasteController = {
        Meta: false,
        v: false
    }
    this.clickingOnCone = false;

    // Keyboard events
    this.keyboard.domElement.addEventListener('keydown', (event) => {
      if(this.roomInput.style.display == 'block'){
        let codeEntry = document.getElementById('roomcode');
        if(this.keyboard.eventMatches(event, 'meta')){
            this.pasteController['Meta'] = true;
        }
        if(this.keyboard.eventMatches(event, 'v')){
            this.pasteController['v'] = true;
        }

        if (this.keyboard.eventMatches(event, 'backspace') ||
          this.keyboard.eventMatches(event, 'delete')) {
            if(codeEntry.value.length > 0){
              codeEntry.value = codeEntry.value.slice(0, -1);
            }
        } else if(this.pasteController['Meta'] && this.pasteController['v']){
            if(navigator.clipboard && window.isSecureContext){
                navigator.clipboard.readText().then((text) => {
                    codeEntry.value = text;
                });
            }
        } else if(codeEntry.value.length < 7 && event.which) {
          let keycode = event.which;
          if((keycode > 47 && keycode < 58) ||
             (keycode > 64 && keycode < 91) ||
             (keycode > 95 && keycode < 112)){
              codeEntry.value += String.fromCharCode(keycode);
            }
        }
        return;
      }

      if (event.simulate || (event.target.tagName === "BODY" && !event.ctrlKey && !event.metaKey)) {
        
        // Only once
        if (event.repeat) {
          return;
        }

        if(event.metaKey){
          return false;
        }
   
        if (this.keyboard.eventMatches(event, 'w')) {
          document.getElementById('help-head').style.display = 'none';
          main.moveForward = 1 * main.movementSpeed;
          main.isAllowMouseDrag = false;
        }

        if (this.keyboard.eventMatches(event, 'a')) {
          document.getElementById('help-head').style.display = 'none';
          main.yawRight = 1 * main.rotationSpeed;
          main.isAllowMouseDrag = false;
        }

        if (this.keyboard.eventMatches(event, 'd')) {
          document.getElementById('help-head').style.display = 'none';
          main.yawLeft = 1 * main.rotationSpeed;
          main.isAllowMouseDrag = false;
        }

        if (this.keyboard.eventMatches(event, 's')) {
          document.getElementById('help-head').style.display = 'none';
          main.moveBackwards = 1 * main.movementSpeed;
          main.isAllowMouseDrag = false;
        }

        if (this.keyboard.eventMatches(event, 'backspace') ||
          this.keyboard.eventMatches(event, 'delete')) {
          if (main.activeObject && main.activeObject.type === 'SoundTrajectory') {
            if (main.activeObject.selectedPoint && main.activeObject.splinePoints.length > 2) {
              main.activeObject.removePoint();
            }
          }

          if (main.activeObject && main.activeObject.type === 'SoundZone') {
            if (main.activeObject.selectedPoint && main.activeObject.splinePoints.length > 3) {
              main.activeObject.removePoint();
            } else {
              main.undoableActionStack.push(new Action(main.activeObject, 'removeSoundZone'));
              main.removeSoundZone(main.activeObject);
              main.activeObject = null;
            }
          }

          if (main.activeObject && main.activeObject.type === 'SoundObject') {
            if(main.isEditingObject){
              if (main.interactiveCone) {
                main.undoableActionStack.push(new Action(main.activeObject, 'removeCone'));
                main.undoableActionStack[main.undoableActionStack.length - 1].secondary = main.interactiveCone;
                main.removeCone(main.activeObject, main.interactiveCone);
              } else {
                // toggle out
                main.exitEditObjectView();
                
                main.undoableActionStack.push(new Action(main.activeObject, 'removeFullObject'));
                main.undoableActionStack[main.undoableActionStack.length - 1].secondary = main.activeObject.trajectory
  
                if (main.activeObject.trajectory){
                  main.removeSoundTrajectory(main.activeObject.trajectory);
                }
                main.removeSoundObject(main.activeObject);
                main.activeObject = null;
              }
            } 
            else {
              main.undoableActionStack.push(new Action(main.activeObject, 'removeFullObject'));
              main.undoableActionStack[main.undoableActionStack.length - 1].secondary = main.activeObject.trajectory

              if (main.activeObject.trajectory){
                main.removeSoundTrajectory(main.activeObject.trajectory);
              }

              main.removeSoundObject(main.activeObject);

              main.activeObject = null;
            }
          }
        }
      
        if (this.keyboard.eventMatches(event, 'bracket-left')){
          main.undo();
        }

        if (this.keyboard.eventMatches(event, 'bracket-right')){
          main.redo();
        }

        if(Config.isDev) {
          if (this.keyboard.eventMatches(event, 'h')) {
            const base = document.getElementsByClassName('rs-base')[0];

            if (base.style.display === 'none') base.style.display = 'block';
            else base.style.display = 'none';
          }
        }
      }
    });

    document.getElementById('roomcode').addEventListener('paste', (event) => {
      if(navigator.clipboard && window.isSecureContext){
          navigator.clipboard.readText().then((text) => {
              let codeEntry = document.getElementById('roomcode');
              if (codeEntry.value.length + text.length <= 7) {
                  codeEntry.value = text;
              }
          });
      }
      event.preventDefault(); // Avoids the pasting twice (default and custom)
    });

    this.keyboard.domElement.addEventListener('keyup', (event) => {
      // Only once
      if (event.repeat) {
        return;
      }

      if(event.metaKey){
        return false;
      }

      if (this.keyboard.eventMatches(event, 'w')) {
        main.moveForward = 0;
        main.movedHead = true;
      }

      if (this.keyboard.eventMatches(event, 'a')) {
        main.yawRight = 0;
        main.movedHead = true;
      }

      if (this.keyboard.eventMatches(event, 'd')) {
        main.yawLeft = 0;
        main.movedHead = true;
      }

      if (this.keyboard.eventMatches(event, 's')) {
        main.moveBackwards = 0;
        main.movedHead = true;
      }

      if (this.keyboard.eventMatches(event, 'meta')) {
        this.pasteController['Meta'] = false;
      }

      if (this.keyboard.eventMatches(event, 'v')) {
        this.pasteController['v'] = false;
      }

      // if (this.keyboard.eventMatches(event, 'r')) {
      //   main.reset(true);
      // }

      if (this.keyboard.eventMatches(event, 'u')) {
        main.isUserStudyLoading = !main.isUserStudyLoading;
        document.getElementById('help-add').style.display = 'none';
        document.getElementById('help-camera').style.display = 'none';
        document.getElementById('help-head').style.display = 'none';
      }
    });
  }

  onMouseOver(event) {
    event.preventDefault();

    Config.isMouseOver = true;
  }

  onMouseLeave(event) {
    event.preventDefault();
    Config.isMouseOver = false;
  }

onMouseMove(main, event) {
    event.preventDefault();

    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { Config.isMouseMoving = false; }, 200);

    Config.isMouseMoving = true;

    main.setMousePosition(event);
    if (main.isMouseDown === true && !main.isEditingObject) {
        if (main.isAddingTrajectory === true) {
            if (main.activeObject.type === 'SoundObject' || main.activeObject.type === 'HeadObject') {
                main.mouse.y = main.activeObject.containerObject.position.y;
                main.path.addPoint(main.mouse);
            }
        }

        if (main.isAddingObject === true) {
            main.path.addPoint(main.mouse);
        }

        if (main.activeObject) {
            if (main.activeObject.type === 'SoundTrajectory') {
                main.activeObject.move(main.mouse, main.nonScaledMouse, main.perspectiveView);
            } else if (main.isAddingTrajectory === true && main.activeObject.type === 'SoundObject') {
                main.activeObject.move(main, true);
            } else {
                main.activeObject.move(main, false);
            }
        }
    } else if (!main.isEditingObject && main.activeObject) {
        let obj = main.activeObject;
        if (obj.type === 'SoundObject' || obj.type === 'HeadObject') {
            if (obj.trajectory) {
                obj = obj.trajectory;
            } else if (obj.type === 'HeadObject') {
                if (!this.tooltipTimeout) {
                    this.tooltipTimeout = setTimeout(() => {
                        main.headObjectTooltip();
                        this.tooltipTimeout = null;
                    }, 100);
                }
                return;
            }
        }

        switch (obj.type) {
            case 'SoundTrajectory':
            case 'SoundZone':
                const intersection = obj.objectUnderMouse(main.ray);
                if (intersection) {
                    obj.showCursor(intersection.object, intersection.point);
                } else {
                    obj.hideCursor();
                }
                break;
            default:
                break;
        }
    }

    if (main.isEditingObject) {
        let intersect3;

        if (main.isMouseDown && this.clickingOnCone) {
            intersect3 = main.ray.intersectObject(main.activeObject.raycastSphere)[0];

            if (main.interactiveCone != null && intersect3) {
                let longlat = main.activeObject.pointCone(main.interactiveCone, intersect3.point);
                if (main.roomCode) {
                    if (main.activeObject.finishUploadingSound) {
                        main.activeObject.dbRef.child('objects').child(main.activeObject.containerObject.name).child('cones').child(main.interactiveCone.uuid).update({
                            longitude: longlat[0],
                            latitude: longlat[1],
                            lastEdit: main.headKey.key
                        });
                    }
                }
            }
        } else {
            intersect3 = main.ray.intersectObjects(main.activeObject.cones)[0];

            main.activeObject.cones.forEach(cone => {
                if (intersect3 && intersect3.object.uuid === cone.uuid) {
                    cone.isHighlighted = true;
                    if ( cone.sound && cone.sound.state.isAudioPaused ) {
                      cone.material.color.set(0x8F8F8F);
                    }
                    else {
                      cone.material.color.set(cone.hoverColor());
                    }
                } else if (cone.isHighlighted) {
                    cone.isHighlighted = false;
                    var materialColor = cone.userSetPlay ? cone.baseColor : 0x8F8F8F;
                    cone.material.color.set(materialColor);
                }
            });
        }
    }

    // rate-limit the head's tooltip display
    if (!this.tooltipTimeout) {
      this.tooltipTimeout = setTimeout(() => {
            main.headObjectTooltip();
            this.tooltipTimeout = null;
        }, 100);
    }
}

  onMouseUp(main, event, hasFocus) {
    // turn gui pointer events back on
    main.gui.enable();
    document.getElementById('GlobalContainer').style.pointerEvents = 'auto';

    // turn controls back on
    main.controls.enable();
    this.clickingOnCone = false;
    // mouse leaves the container
    if (!hasFocus) { Config.isMouseOver = false; }
    if (main.isMouseDown === false) { return; }

    // actual mouseup interaction
    main.setMousePosition(event);
    let obj;

    if (main.isAddingTrajectory) {
      obj = main.path.createObject(main);
      if(main.roomCode){
          obj.ownerHeadKey = main.headKey.key;
      }

      main.toggleAddTrajectory(false);
    }

    if (main.isAddingObject) {
      obj = main.path.createObject(main);

      main.setActiveObject(obj);
      main.toggleAddObject();
      main.isAddingObject = false;
    }
  

    if (main.isEditingObject) {
      if (main.interactiveCone) {
        if ( main.interactiveCone.sound && main.interactiveCone.sound.state.isAudioPaused ) {
          main.interactiveCone.material.color.set(0x8F8F8F);
        }
        else {
          main.interactiveCone.material.color.set(main.interactiveCone.baseColor);
        }
      }
    }
    main.isMouseDown = false;

    for (const i in main.soundObjects) {
      if (main.soundObjects[i].type === 'SoundObject') main.soundObjects[i].calculateMovementSpeed();
    }

    if (main.headObject.trajectory) {
      main.headObject.calculateMovementSpeed();
    }
  }

  onMouseDown(main) {
    if(this.roomInput.style.display == 'block'){
        document.getElementById('splashscreen').style.display = 'none';
    }
    // turn gui events off when interacting with scene objects
    main.gui.disable();
    document.getElementById('GlobalContainer').style.pointerEvents = 'none';

    /**
     * !keyPressed is added to avoid interaction with object when the camera
     * is being rotated. It can (should) be changed into a flag more specific
     * to this action.
     */

    if (!main.keyPressed) {
      main.isMouseDown = true;

      /**
       * Create a collection array of all the object in the scene and check if
       * any of these objects isUnderMouse (a function which is passed our raycaster).
       *
       * If there is indeed an intersected object, set it as the activeObject.
       */
      const everyComponent = [].concat(main.soundObjects, main.headObject, main.soundTrajectories, main.soundZones);
      const intersectObjects = everyComponent.filter((obj) => {
        return obj.isUnderMouse(main.ray);
      });

      // if adding trajectory, check that mousedown is valid
      main.isAddingTrajectory = (main.isAddingTrajectory && intersectObjects[0] === main.activeObject);
      
      // set activeObject to intersected object

      if (!main.isEditingObject) {
        if (intersectObjects.length > 0 && !main.isAddingObject) {
          // if soundzones overlap, keep last selected
          if (intersectObjects[0].type !== 'SoundTrajectory' && !(main.activeObject && main.activeObject.type === 'SoundZone' && intersectObjects[0].type === 'SoundZone' && intersectObjects.indexOf(main.activeObject) > -1)) {
            main.setActiveObject(intersectObjects[0]);
          }
          else if(intersectObjects[0].type === 'SoundTrajectory'){
            if(main.roomCode == null || intersectObjects[0].parentSoundObject.type !== 'HeadObject' || (intersectObjects[0].parentSoundObject.type === 'HeadObject' && main.roomCode && intersectObjects[0].ownerHeadKey == main.headKey.key)){
                main.setActiveObject(intersectObjects[0]);
            }
          }
        }
        else {
          main.setActiveObject(null);
        }
      }
      // disable controls when add or moving an object
      if (main.isAddingTrajectory || main.isAddingObject || (main.activeObject && !main.isEditingObject)) {
        main.controls.disable();
      }

      /**
       * If adding a trajectory, ask the trajectory interface to initate a new
       * trajectory at the mouse position determined in setMousePosition()
       *
       * Same for the zone.
       */
      if (main.isAddingTrajectory) {
        main.mouse.y = main.activeObject.containerObject.position.y;
        main.path.beginAt(main.mouse, main.activeObject);
      }

      if (main.isAddingObject) {
        main.path.beginAt(main.mouse);
      }

      /* If the most recent active object interacted with again, select it: */
      if (main.activeObject && main.activeObject.isUnderMouse(main.ray)) {
        // click inside active object
        if (main.activeObject.type != 'SoundObject' && main.activeObject.type != 'HeadObject'){
          const intersect = main.activeObject.objectUnderMouse(main.ray);
          main.activeObject.select(intersect, main);
        } else {
          main.activeObject.select(main);
        }
      }

      /**
       * In object edit mode a different interaction scheme is followed.
       */
      if (main.isEditingObject) {
        if (!main.activeObject || !main.activeObject.cones) {
          console.log('wheres my cone :(', main.activeObject); //error check
        }

        const intersect2 = main.ray.intersectObjects(main.activeObject.cones)[0];
        if (intersect2) {
          this.clickingOnCone = true;
          main.interactiveCone = intersect2.object;
          main.controls.disable();
        }
        // else {
        //   main.interactiveCone = null;
        // }
      }
    }
  }

}
