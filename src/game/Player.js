import * as THREE from 'three';
import { Character } from './Character.js';
import { WORLD, CAMERA } from './Constants.js';

export class Player extends Character {
  constructor(opts) {
    super({ ...opts, furHex: '#c98a3c', bandanaHex: '#c0392b', name: 'You', isPlayer: true });
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._camShake = 0;
  }

  update(dt, input) {
    if (this.alive) {
      this.applyTankMove(dt, input.forward, input.turn, WORLD.turnSpeed, WORLD.moveSpeed);
      if (input.consumeJump()) {
        this.jump();
      }
    }
    this.updatePhysics(dt);
  }

  addRecoilShake(amount) {
    this._camShake = Math.min(0.35, this._camShake + amount);
  }

  updateCamera(camera, dt) {
    const dogY = this.root.position.y;
    const back = this.forwardVector.multiplyScalar(-CAMERA.followDistance);
    const targetPos = new THREE.Vector3(
      this.position.x + back.x,
      dogY + CAMERA.followHeight,
      this.position.z + back.z
    );
    this._camPos.lerp(targetPos, 1 - Math.pow(0.0008, dt));
    const lookTarget = new THREE.Vector3(
      this.position.x,
      dogY + CAMERA.lookHeight,
      this.position.z
    );
    this._camLook.lerp(lookTarget, 1 - Math.pow(0.0005, dt));

    if (this._camShake > 0) {
      this._camShake = Math.max(0, this._camShake - dt * 1.4);
      const s = this._camShake;
      camera.position.set(
        this._camPos.x + (Math.random() - 0.5) * s,
        this._camPos.y + (Math.random() - 0.5) * s,
        this._camPos.z + (Math.random() - 0.5) * s
      );
    } else {
      camera.position.copy(this._camPos);
    }
    camera.lookAt(this._camLook);
  }
}
