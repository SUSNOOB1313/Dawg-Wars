import * as THREE from 'three';
import { buildDog } from './DogModel.js';
import { WORLD, WEAPON, COMBAT } from './Constants.js';

const UP = new THREE.Vector3(0, 1, 0);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
    }
  }
}

// Ray vs AABB (2D, treating building footprints as infinitely tall) — used
// for line-of-sight blocking between combatants.
function segmentBlockedByColliders(ax, az, bx, bz, colliders) {
  const dx = bx - ax;
  const dz = bz - az;
  for (const c of colliders) {
    let tmin = 0;
    let tmax = 1;
    if (Math.abs(dx) < 1e-6) {
      if (ax < c.minX || ax > c.maxX) continue;
    } else {
      let t1 = (c.minX - ax) / dx;
      let t2 = (c.maxX - ax) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-6) {
      if (az < c.minZ || az > c.maxZ) continue;
    } else {
      let t1 = (c.minZ - az) / dz;
      let t2 = (c.maxZ - az) / dz;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }
    if (tmin <= tmax && tmax >= 0 && tmin <= 1) return true;
  }
  return false;
}

let nextId = 1;

export class Character {
  constructor({ scene, colliders, furHex, bandanaHex, name, isPlayer = false }) {
    this.id = nextId++;
    this.scene = scene;
    this.colliders = colliders;
    this.name = name;
    this.isPlayer = isPlayer;

    const dog = buildDog({ furHex, bandanaHex });
    this.dog = dog;
    this.root = dog.root;
    scene.add(this.root);

    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // yaw, radians, 0 = +Z
    this.velocityY = 0;
    this.grounded = true;
    this.radius = isPlayer ? WORLD.playerRadius : WORLD.botRadius;

    this.maxHP = COMBAT.maxHP;
    this.hp = this.maxHP;
    this.alive = true;
    this.deathOrder = null; // set by Game on death

    this.reloadTimer = 0; // 0 = ready to fire
    this.muzzleFlashTimer = 0;
    this._walkCycle = 0;
    this._deathSink = 0;
    this._legStrideBase = { frontLeft: 1, backRight: 1, frontRight: -1, backLeft: -1 };

    this.speedFactor = 1; // 0..1, how fast this frame's move was (for animation)
  }

  get forwardVector() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get rightVector() {
    return new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  muzzleWorldPosition() {
    const p = new THREE.Vector3();
    this.dog.muzzle.getWorldPosition(p);
    return p;
  }

  canFire() {
    return this.alive && this.reloadTimer <= 0;
  }

  fire() {
    if (!this.canFire()) return null;
    this.reloadTimer = WEAPON.reloadTime;
    this.muzzleFlashTimer = WEAPON.muzzleFlashTime;
    return this.muzzleWorldPosition();
  }

  jump() {
    if (!this.alive || !this.grounded) return false;
    this.velocityY = WORLD.bounceJumpVelocity;
    this.grounded = false;
    return true;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.alive = false;
  }

  // Applies tank-style movement: turn is +1 (turn left/CCW) .. -1 (turn right/CW),
  // forward is +1 forward .. -1 backward. Returns actual distance moved (for anim).
  applyTankMove(dt, forwardInput, turnInput, turnSpeed, moveSpeed) {
    this.heading += turnInput * turnSpeed * dt;
    const dist = forwardInput * moveSpeed * dt;
    if (dist !== 0) {
      this.position.x += Math.sin(this.heading) * dist;
      this.position.z += Math.cos(this.heading) * dist;
      resolveCollisions(this.position, this.radius, this.colliders);
    }
    this.speedFactor = clamp(Math.abs(dist) / (moveSpeed * dt || 1), 0, 1) * Math.sign(forwardInput || 1);
    return dist;
  }

  // Free-form move toward a direction vector (used by bot strafing) rather than
  // pure tank forward/back; still turn-limited elsewhere.
  applyDirectMove(dt, dirX, dirZ, speed) {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-5) {
      this.speedFactor = 0;
      return;
    }
    const nx = (dirX / len) * speed * dt;
    const nz = (dirZ / len) * speed * dt;
    this.position.x += nx;
    this.position.z += nz;
    resolveCollisions(this.position, this.radius, this.colliders);
    this.speedFactor = 1;
  }

  turnToward(targetHeading, dt, turnSpeed) {
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxStep = turnSpeed * dt;
    if (Math.abs(diff) <= maxStep) {
      this.heading = targetHeading;
    } else {
      this.heading += Math.sign(diff) * maxStep;
    }
    return diff;
  }

  updatePhysics(dt) {
    if (!this.alive) {
      this._deathSink = Math.min(0.55, this._deathSink + dt * 1.4);
      this.root.rotation.z = Math.min(Math.PI / 2.1, this._deathSink * (Math.PI / 0.55));
      this.root.position.set(this.position.x, 0.05, this.position.z);
      return;
    }
    this.velocityY += WORLD.gravity * dt;
    let y = (this.root.position.y || 0) + this.velocityY * dt;
    if (y <= 0) {
      y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }
    this.root.position.set(this.position.x, y, this.position.z);
    this.root.rotation.y = this.heading;

    if (this.reloadTimer > 0) this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      this.dog.flashLight.intensity = this.muzzleFlashTimer > 0 ? 6 : 0;
    }

    this._animate(dt, y);
  }

  _animate(dt, airY) {
    const inAir = airY > 0.02;
    const speed = this.speedFactor || 0;
    if (inAir) {
      this._walkCycle += dt * 4;
      const spread = clamp(airY / 2, 0, 1);
      for (const leg of Object.values(this.dog.legs)) {
        leg.rotation.x = -0.5 * spread;
      }
      this.dog.tail.rotation.x = 0.4;
    } else if (Math.abs(speed) > 0.05) {
      this._walkCycle += dt * 10 * Math.max(0.4, Math.abs(speed));
      for (const [name, leg] of Object.entries(this.dog.legs)) {
        const dir = this._legStrideBase[name];
        leg.rotation.x = Math.sin(this._walkCycle * (speed < 0 ? -1 : 1) + (dir > 0 ? 0 : Math.PI)) * 0.55;
      }
      this.dog.tail.rotation.x = Math.sin(this._walkCycle * 2) * 0.15;
    } else {
      this._walkCycle += dt * 2;
      for (const leg of Object.values(this.dog.legs)) {
        leg.rotation.x *= 0.85;
      }
      this.dog.tail.rotation.x = Math.sin(this._walkCycle) * 0.08;
      this.dog.head.position.y = 1.0 + Math.sin(this._walkCycle * 1.3) * 0.01;
    }
    // ear perk toward motion, subtle bob
    this.dog.body.position.y = inAir ? 0 : Math.abs(Math.sin(this._walkCycle * 2)) * 0.015;
  }

  hasLineOfSightTo(other) {
    return !segmentBlockedByColliders(this.position.x, this.position.z, other.position.x, other.position.z, this.colliders);
  }

  distanceTo(other) {
    return Math.hypot(this.position.x - other.position.x, this.position.z - other.position.z);
  }

  dispose() {
    this.scene.remove(this.root);
  }
}

export { segmentBlockedByColliders };
