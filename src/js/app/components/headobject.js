
import * as THREE from 'three';
import 'whatwg-fetch';

import Config from '../../data/config';
import Helpers from '../../utils/helpers';

export default class HeadObject {
  constructor(main) {
    this.locked = false;
    this.type = 'HeadObject';
    this.rotation = {};
    this.radius = 60;
    this.app = main;
    this.roomCode = main.roomCode;

    this.trajectory = null;
    this.trajectoryClock = Config.soundObject.defaultTrajectoryClock;
    this.movementSpeed = Config.soundObject.defaultMovementSpeed;
    this.movementDirection = Config.soundObject.defaultMovementDirection;
    this.movementIncrement = null;
    this.oldPosition = null;
    this.hasBeenMoved = false;
    this.lastPathPosition = new THREE.Vector3();

    this.tangent = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 0, -1);
    this.counter = 0;

    const sphereGeometry = new THREE.SphereBufferGeometry(this.radius, 100, 100);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      opacity: 0,
      transparent: true,
      depthWrite: false
    });
    this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    this.sphere.castShadow = false;

    this.containerObject = new THREE.Object3D();
    this.containerObject.add(this.sphere);
    main.scene.add(this.containerObject);
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

  clear() {
    if (this.trajectory) {
      this.app.removeSoundTrajectory(this.trajectory);
      this.trajectory = null;
      this.trajectoryClock = Config.soundObject.defaultMovementSpeed;
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

    if (this.trajectory) this.trajectory.move(pointer, main.nonScaledMouse, main.perspectiveView);

    this.containerObject.position.copy(pointer);
    this.app.isAllowMouseDrag = true;

    if(!isTrajectoryDragging){
      this.hasBeenMoved = true;
    }
  }

  setPosition(position) {
    this.containerObject.position.copy(position);
  }

  resetPosition() {
      this.app.headObject.containerObject.position.setY(0);
      this.app.head.position.setY(0);
      this.app.altitudeHelper.position.copy(this.app.head.position);
      this.app.altitudeHelper.position.y = 0;
      this.app.axisHelper.position.copy(this.app.head.position);

      // set the quaternion
      var resetAxis = new THREE.Vector3(0, 0, -1);
      this.containerObject.quaternion.setFromAxisAngle(resetAxis, 0);
      this.app.head.quaternion.setFromAxisAngle(resetAxis, 0);
      this.app.axisHelper.quaternion.setFromAxisAngle(resetAxis, 0);
  }

  calculateMovementSpeed() {
    if (this.trajectory) {
      this.movementIncrement = this.movementSpeed / this.trajectory.spline.getLength(20);
    }
  }

  updateSpeed(rawSpeed){
    if(this.roomCode != null){
      this.app.dbRef.child('users').child(this.app.headKey.key).update({
        speed: rawSpeed
      });
    }
  }

  followTrajectory(play, otherHead = null) {
    if (this.trajectory && play) {
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

      // get the tangent to the curve
      this.tangent = this.trajectory.spline.getTangent(this.trajectoryClock).normalize();

      // calculate the axis to rotate around
      this.axis.crossVectors(this.up, this.tangent).normalize();

      // calcluate the angle between the up vector and the tangent
      var radians = Math.acos(this.up.dot(this.tangent));
      // radians -= Math.PI;

      // set the quaternion
      this.containerObject.quaternion.setFromAxisAngle(this.axis, radians);
      if(otherHead == null){
        // TODO: 
        this.app.head.quaternion.setFromAxisAngle(this.axis, radians);
        this.app.axisHelper.quaternion.setFromAxisAngle(this.axis, radians);
      } else {
        otherHead.quaternion.setFromAxisAngle(this.axis, radians);
      }

      // this.counter = (this.counter >= 1) ? 0 : this.counter += 0.002;

    }
  }

  toJSON() {
    return JSON.stringify({
      position: this.containerObject.position,
      rotation: this.rotation,
      movementSpeed: this.movementSpeed,
      trajectory: (this.trajectory && this.trajectory.points) || null
    });
  }

  fromJSON(json, importedData) {
    const object = JSON.parse(json);
    this.containerObject.position.copy(object.position);
    this.rotation = object.rotation;
    this.movementSpeed = object.movementSpeed;

    this.app.axisHelper.position.copy(this.containerObject.position);
    this.app.head.position.copy(this.containerObject.position);
    this.app.axisHelper.rotation.y = this.rotation.y;
    this.app.head.rotation.y = this.rotation.y;
  }
}