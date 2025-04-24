import * as THREE from 'three';
import SoundObject from '../components/soundobject';
import SoundTrajectory from '../components/soundtrajectory';
import SoundZone from '../components/soundzone';

export default class Action {
    constructor(object1, type){
        this.mainObject = object1;
        this.actionType = type;
        this.cone;
        this.secondary;
    }
}