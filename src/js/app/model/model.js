import * as THREE from 'three';

import Material from '../helpers/material';
import MeshHelper from '../helpers/meshHelper';
import Helpers from '../../utils/helpers';
import Config from '../../data/config';

// Loads in a single object from the config file
export default class Model {
  constructor(scene, loader) {
    this.scene = scene;

    // Manager is passed in to loader to determine when loading done in main
    this.loader = loader;
    this.obj = null;
  }

  load(locked, name = false, pos, otherHeadKey = null, dbRef = null) {
    // Load model with ObjectLoader
    this.loader.load(Config.model.path, obj => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Create material for mesh and set its map to texture by name from preloaded textures
          let color = '0x';
          if(locked){
            color = this.getRandomColor();
          } else {
            color = 0x44aaff;
          }
          const material = new Material(color).basic;
          child.material = material;
          material.transparent = true;
          if(locked){
            material.opacity = 0.5;
          } else {
            material.opacity = 0.8;
          }

          // Set to cast and receive shadow if enabled
          if (Config.shadow.enabled) {
            child.receiveShadow = true;
            child.castShadow = true;
          }
        }
      });

      // Set prop to obj
      this.obj = obj;

      obj.name = name;
      if(!name){
        obj.name = 'dummyHead';
      }

      if(!locked){
        obj.position.y = 0; // necessary for raycasting onto the zone shape
      } else {
        obj.position.copy(new THREE.Vector3(pos.x, pos.y, pos.z));
      }
      
      obj.rotation.y += Math.PI;
      obj.scale.multiplyScalar(Config.model.scale);

      this.scene.add(obj);
      if(dbRef != null){
        dbRef.child('users').child(otherHeadKey).update({});
      }
    });
  }
  
  getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
}
