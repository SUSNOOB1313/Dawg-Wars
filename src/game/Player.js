import * as THREE from 'three';
import { Character } from './Character.js';
import { WORLD, CAMERA, AIM_ASSIST } from './Constants.js';

const deg2rad = (d) => (d * Math.PI) / 180;

export class Player extends Character {
  constructor(opts) {
    super({ ...opts, furHex: '#ffcc1a', bandanaHex: '#ff3b2f', name: 'You', isPlayer: true });
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._camShake = 0;
    this.isAimLocked = false; // whether the turn-assist magnet currently has a target
  }

  // Finds the nearest (by angle) alive, visible enemy within `coneDeg` of the
  // current heading and within `range`. Returns { other, diff } where diff is
  // the signed angular distance (radians) from heading to that target's
  // bearing, or null if nothing qualifies.
  computeAimAssist(allCharacters, coneDeg, range) {
    if (!allCharacters) return null;
    const coneHalf = deg2rad(coneDeg);
    let best = null;
    let bestAbsDiff = Infinity;
    for (const other of allCharacters) {
      if (other === this || !other.alive) continue;
      if (this.distanceTo(other) > range) continue;
      const bearing = Math.atan2(other.position.x - this.position.x, other.position.z - this.position.z);
      let diff = bearing - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > coneHalf) continue;
      if (!this.hasLineOfSightTo(other)) continue;
      if (Math.abs(diff) < bestAbsDiff) {
        bestAbsDiff = Math.abs(diff);
        best = { other, diff };
      }
    }
    return best;
  }

  update(dt, input, allCharacters) {
    if (this.alive) {
      let turnInput = input.turn;
      const assist = this.computeAimAssist(allCharacters, AIM_ASSIST.turnMagnetConeDeg, AIM_ASSIST.turnMagnetRange);
      this.isAimLocked = !!assist;
      if (assist) {
        const coneHalf = deg2rad(AIM_ASSIST.turnMagnetConeDeg);
        const pull = Math.max(-1, Math.min(1, assist.diff / coneHalf)) * AIM_ASSIST.turnMagnetStrength;
        // Never fight a deliberate turn away from the target — only ever
        // helps you catch/hold a target, never resists disengaging.
        if (input.turn === 0 || Math.sign(input.turn) === Math.sign(pull)) {
          turnInput += pull;
        }
      }
      this.applyTankMove(dt, input.forward, turnInput, WORLD.turnSpeed, WORLD.moveSpeed);
      if (input.consumeJump()) {
        this.jump();
      }
    } else {
      this.isAimLocked = false;
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
