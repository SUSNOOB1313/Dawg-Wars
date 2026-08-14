import * as THREE from 'three';
import { Character } from './Character.js';
import { WORLD, COMBAT, WEAPON } from './Constants.js';

const deg2rad = (d) => (d * Math.PI) / 180;
const VISION_HALF = deg2rad(COMBAT.engagedVisionConeDeg);
const AIM_TOLERANCE = deg2rad(COMBAT.botAimToleranceDeg);
const ACCURACY_SPREAD = deg2rad(COMBAT.botAccuracySpreadDeg);

const FUR_COLORS = ['#8a5a34', '#6b4a2e', '#c9a15f', '#4a4a4a', '#a9702f', '#7a3b2a', '#d4b483', '#5c4a3a', '#916f4f', '#3d3d3d', '#b98b52', '#6f5843', '#9c6644', '#59422f', '#c48a3f'];
const BANDANA_COLORS = ['#2c5f7c', '#b23b3b', '#3b7c4a', '#7c3b8f', '#c9a227', '#3b3b3b', '#c96b2f'];

function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Bot extends Character {
  constructor(opts, index) {
    const fur = FUR_COLORS[index % FUR_COLORS.length];
    const bandana = BANDANA_COLORS[index % BANDANA_COLORS.length];
    super({ ...opts, furHex: fur, bandanaHex: bandana, name: `Bandit ${index + 1}` });

    this.state = 'wander';
    this.threats = new Set();
    this.lastSeenTime = new Map();
    this.targetPrevPos = new Map();
    this.currentTarget = null;
    this.wanderTarget = null;
    this.wanderWaitTimer = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeFlipTimer = 2 + Math.random() * 2;
    this._fireRequested = false;
    this.arenaHalf = opts.arenaHalf || 60;
  }

  get fireRequested() {
    if (this._fireRequested) {
      this._fireRequested = false;
      return true;
    }
    return false;
  }

  perceive(allCharacters, t) {
    for (const other of allCharacters) {
      if (other === this || !other.alive) continue;
      const dist = this.distanceTo(other);
      if (dist > COMBAT.noticeRadius) continue;

      if (this.threats.has(other)) {
        if (this.hasLineOfSightTo(other)) this.lastSeenTime.set(other, t);
        continue;
      }

      if (this.state !== 'combat') {
        if (this.hasLineOfSightTo(other)) this._addThreat(other, t);
      } else {
        const toOther = Math.atan2(other.position.x - this.position.x, other.position.z - this.position.z);
        const angleDiff = Math.abs(angleWrap(toOther - this.heading));
        if (angleDiff <= VISION_HALF && this.hasLineOfSightTo(other)) {
          this._addThreat(other, t);
        }
      }
    }

    for (const threat of Array.from(this.threats)) {
      const seen = this.lastSeenTime.get(threat) ?? 0;
      if (!threat.alive || t - seen > COMBAT.loseTargetTime) {
        this.threats.delete(threat);
        this.lastSeenTime.delete(threat);
        this.targetPrevPos.delete(threat);
      }
    }
    if (this.threats.size === 0 && this.state === 'combat') {
      this.state = 'wander';
      this.currentTarget = null;
    }
  }

  _addThreat(other, t) {
    this.threats.add(other);
    this.lastSeenTime.set(other, t);
    this.state = 'combat';
  }

  _pickCurrentTarget() {
    let best = null;
    let bestDist = Infinity;
    for (const threat of this.threats) {
      if (!threat.alive) continue;
      const d = this.distanceTo(threat);
      if (d < bestDist) {
        bestDist = d;
        best = threat;
      }
    }
    this.currentTarget = best;
    return best;
  }

  _estimateVelocity(target, dt) {
    const prev = this.targetPrevPos.get(target);
    this.targetPrevPos.set(target, target.position.clone());
    if (!prev || dt <= 0) return new THREE.Vector3();
    return new THREE.Vector3((target.position.x - prev.x) / dt, 0, (target.position.z - prev.z) / dt);
  }

  update(dt, allCharacters, t) {
    if (!this.alive) {
      this.updatePhysics(dt);
      return;
    }
    this.perceive(allCharacters, t);
    if (this.state === 'combat') {
      this._combatBehavior(dt, t);
    } else {
      this._wanderBehavior(dt, t);
    }
    if (this.grounded && this.state === 'combat' && Math.random() < COMBAT.botJumpChance) {
      this.jump();
    }
    this.updatePhysics(dt);
  }

  _combatBehavior(dt, t) {
    const target = this._pickCurrentTarget();
    if (!target) {
      this.state = 'wander';
      return;
    }

    const vel = this._estimateVelocity(target, dt);
    const dist = this.distanceTo(target);
    const leadTime = Math.min(0.5, dist / 26);
    const aimX = target.position.x + vel.x * leadTime;
    const aimZ = target.position.z + vel.z * leadTime;
    const desiredHeading = Math.atan2(aimX - this.position.x, aimZ - this.position.z);
    const turnDiff = this.turnToward(desiredHeading, dt, COMBAT.botAimTurnSpeed);

    // maintain preferred range: approach / retreat / strafe
    this.strafeFlipTimer -= dt;
    if (this.strafeFlipTimer <= 0) {
      this.strafeFlipTimer = 1.5 + Math.random() * 2.5;
      if (Math.random() < 0.6) this.strafeDir *= -1;
    }

    const toTarget = new THREE.Vector3(target.position.x - this.position.x, 0, target.position.z - this.position.z);
    let moveX = 0;
    let moveZ = 0;
    if (dist > COMBAT.preferredRangeMax) {
      moveX += toTarget.x;
      moveZ += toTarget.z;
    } else if (dist < COMBAT.preferredRangeMin) {
      moveX -= toTarget.x;
      moveZ -= toTarget.z;
    }
    const right = this.rightVector;
    moveX += right.x * this.strafeDir * 0.8;
    moveZ += right.z * this.strafeDir * 0.8;

    this.applyDirectMove(dt, moveX, moveZ, COMBAT.botStrafeSpeed);
    this._clampToArena();

    const hasLoS = this.hasLineOfSightTo(target);
    if (Math.abs(turnDiff) <= AIM_TOLERANCE && hasLoS && this.canFire() && dist <= WEAPON.maxRange) {
      this._fireRequested = true;
    }
  }

  _wanderBehavior(dt, t) {
    if (!this.wanderTarget || this.distanceTo({ position: this.wanderTarget }) < 1.5) {
      if (this.wanderWaitTimer > 0) {
        this.wanderWaitTimer -= dt;
        this.speedFactor = 0;
        return;
      }
      const half = this.arenaHalf * 0.85;
      this.wanderTarget = new THREE.Vector3((Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half);
      this.wanderWaitTimer = Math.random() * 1.5;
    }
    const desiredHeading = Math.atan2(this.wanderTarget.x - this.position.x, this.wanderTarget.z - this.position.z);
    this.turnToward(desiredHeading, dt, WORLD.botTurnSpeed * 0.7);
    const headingDiff = Math.abs(angleWrap(desiredHeading - this.heading));
    const forwardInput = headingDiff < Math.PI / 2 ? 0.55 : 0;
    this.applyTankMove(dt, forwardInput, 0, 0, WORLD.moveSpeed);
    this._clampToArena();
  }

  _clampToArena() {
    const half = this.arenaHalf - 1.5;
    this.position.x = Math.max(-half, Math.min(half, this.position.x));
    this.position.z = Math.max(-half, Math.min(half, this.position.z));
  }
}
