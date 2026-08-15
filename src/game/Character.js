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
  constructor({ scene, colliders, furHex, bandanaHex, gradientMap, name, isPlayer = false }) {
    this.id = nextId++;
    this.scene = scene;
    this.colliders = colliders;
    this.name = name;
    this.isPlayer = isPlayer;

    const dog = buildDog({ furHex, bandanaHex, gradientMap });
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
    this.knockback = new THREE.Vector3(0, 0, 0); // horizontal velocity from being hit, decays over time

    this.reloadTimer = 0; // 0 = ready to fire
    this.muzzleFlashTimer = 0;
    this._walkCycle = 0;
    this._deathSink = 0;
    this._legStrideBase = { legL: 1, legR: -1 };
    this._bodyScale = new THREE.Vector3(1, 1, 1);
    this._landSquash = 0;

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

  // Every landed shotgun blast costs exactly one hit, regardless of how many
  // pellets connected — clean and predictable: 6 hits down, no exceptions.
  takeHit() {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - 1);
    if (this.hp <= 0) this.alive = false;
  }

  // Shoves the character horizontally (e.g. from a shotgun blast). Stacks
  // with any existing knockback so rapid multi-hits launch you further,
  // clamped so it can't go absurd.
  applyKnockback(direction, strength) {
    this.knockback.x += direction.x * strength;
    this.knockback.z += direction.z * strength;
    const len = Math.hypot(this.knockback.x, this.knockback.z);
    if (len > COMBAT.knockbackMax) {
      const scale = COMBAT.knockbackMax / len;
      this.knockback.x *= scale;
      this.knockback.z *= scale;
    }
  }

  _integrateKnockback(dt) {
    if (this.knockback.x === 0 && this.knockback.z === 0) return;
    this.position.x += this.knockback.x * dt;
    this.position.z += this.knockback.z * dt;
    resolveCollisions(this.position, this.radius, this.colliders);
    const decay = Math.max(0, 1 - COMBAT.knockbackFriction * dt);
    this.knockback.x *= decay;
    this.knockback.z *= decay;
    if (Math.hypot(this.knockback.x, this.knockback.z) < 0.05) {
      this.knockback.x = 0;
      this.knockback.z = 0;
    }
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
      this._integrateKnockback(dt); // a killing blow still sends the ragdoll skidding
      this._deathSink = Math.min(0.55, this._deathSink + dt * 1.4);
      this.root.rotation.z = Math.min(Math.PI / 2.1, this._deathSink * (Math.PI / 0.55));
      this.root.position.set(this.position.x, 0.05, this.position.z);
      return;
    }
    this._integrateKnockback(dt);
    const wasGrounded = this.grounded;
    this.velocityY += WORLD.gravity * dt;
    let y = (this.root.position.y || 0) + this.velocityY * dt;
    if (y <= 0) {
      y = 0;
      this.velocityY = 0;
      this.grounded = true;
    }
    if (this.grounded && !wasGrounded) this._landSquash = 1; // just touched down — trigger a squish
    this.root.position.set(this.position.x, y, this.position.z);
    this.root.rotation.y = this.heading;

    if (this.reloadTimer > 0) this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      this.dog.flashLight.intensity = this.muzzleFlashTimer > 0 ? 6 : 0;
    }

    this._animate(dt, y);
  }

  // Bouncy blob rig: 2 stub legs + 2 mitten arms swing for locomotion, the
  // whole body squashes/stretches (anchored at ground level) for jumps and
  // landings, and the tail gives a little idle wag.
  _animate(dt, airY) {
    const inAir = airY > 0.02;
    const speed = this.speedFactor || 0;
    const dog = this.dog;

    if (this._landSquash > 0) this._landSquash = Math.max(0, this._landSquash - dt * 5.5);

    let targetScaleY = 1;
    let targetScaleXZ = 1;

    if (inAir) {
      this._walkCycle += dt * 4;
      const rise = clamp(this.velocityY / 10, -1, 1);
      targetScaleY = 1 + rise * 0.16;
      targetScaleXZ = 1 - rise * 0.1;
      const swing = -0.35 * clamp(airY / 1.5, 0, 1);
      dog.legL.rotation.x = swing;
      dog.legR.rotation.x = swing;
      dog.armL.rotation.x = -0.3;
      dog.armR.rotation.x = -0.3;
      dog.tail.rotation.x = 0.4;
    } else if (Math.abs(speed) > 0.05) {
      this._walkCycle += dt * 11 * Math.max(0.4, Math.abs(speed));
      const dir = speed < 0 ? -1 : 1;
      const swing = Math.sin(this._walkCycle * dir) * 0.6;
      dog.legL.rotation.x = swing * this._legStrideBase.legL;
      dog.legR.rotation.x = swing * this._legStrideBase.legR;
      dog.armL.rotation.x = -swing * this._legStrideBase.legL * 0.5;
      dog.armR.rotation.x = -swing * this._legStrideBase.legR * 0.5;
      dog.tail.rotation.x = Math.sin(this._walkCycle * 2) * 0.15;
      targetScaleY = 1 + Math.abs(Math.sin(this._walkCycle * 2)) * 0.03;
    } else {
      this._walkCycle += dt * 2;
      dog.legL.rotation.x *= 0.8;
      dog.legR.rotation.x *= 0.8;
      dog.armL.rotation.x *= 0.8;
      dog.armR.rotation.x *= 0.8;
      dog.tail.rotation.x = Math.sin(this._walkCycle) * 0.08;
      targetScaleY = 1 + Math.sin(this._walkCycle * 1.3) * 0.012; // idle breathing
      targetScaleXZ = 1 - Math.sin(this._walkCycle * 1.3) * 0.008;
    }

    // landing squash overrides: wide and flat right after touchdown, easing back
    if (this._landSquash > 0) {
      const s = this._landSquash;
      targetScaleY = targetScaleY * (1 - s) + (1 - 0.32 * s) * s;
      targetScaleXZ = targetScaleXZ * (1 - s) + (1 + 0.22 * s) * s;
    }

    const lerpT = 1 - Math.pow(0.001, dt);
    this._bodyScale.x += (targetScaleXZ - this._bodyScale.x) * lerpT;
    this._bodyScale.z += (targetScaleXZ - this._bodyScale.z) * lerpT;
    this._bodyScale.y += (targetScaleY - this._bodyScale.y) * lerpT;
    dog.body.scale.copy(this._bodyScale);
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
