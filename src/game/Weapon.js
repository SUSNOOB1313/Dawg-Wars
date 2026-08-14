import * as THREE from 'three';
import { WEAPON } from './Constants.js';

function rayAabbDistance(ox, oz, dx, dz, c) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-6) {
    if (ox < c.minX || ox > c.maxX) return Infinity;
  } else {
    let t1 = (c.minX - ox) / dx;
    let t2 = (c.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dz) < 1e-6) {
    if (oz < c.minZ || oz > c.maxZ) return Infinity;
  } else {
    let t1 = (c.minZ - oz) / dz;
    let t2 = (c.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmin > tmax || tmax < 0) return Infinity;
  return tmin > 0 ? tmin : tmax;
}

function raySphereDistance(origin, dir, center, radius) {
  const ocx = origin.x - center.x;
  const ocy = origin.y - center.y;
  const ocz = origin.z - center.z;
  const b = ocx * dir.x + ocy * dir.y + ocz * dir.z;
  const c = ocx * ocx + ocy * ocy + ocz * ocz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = -b - sqrtDisc;
  const t2 = -b + sqrtDisc;
  if (t1 >= 0) return t1;
  if (t2 >= 0) return t2;
  return Infinity;
}

function falloffDamage(distance) {
  const { falloffStart, falloffEnd, pelletDamageClose, pelletDamageFar } = WEAPON;
  if (distance <= falloffStart) return pelletDamageClose;
  if (distance >= falloffEnd) return pelletDamageFar;
  const t = (distance - falloffStart) / (falloffEnd - falloffStart);
  return pelletDamageClose + (pelletDamageFar - pelletDamageClose) * t;
}

const TARGET_HITBOX_RADIUS = 0.65;
const TARGET_HITBOX_HEIGHT = 0.85;

/**
 * Fires one shotgun blast of pellets from `shooter` toward its forward
 * direction, with cone spread. Returns { hitsByTarget: Map<Character, dmg>, pelletDirs }
 */
export function fireShotgun(shooter, allCharacters, colliders, extraSpreadRad = 0) {
  const origin = shooter.muzzleWorldPosition();
  const halfAngle = WEAPON.spreadAngle + extraSpreadRad;
  const hitsByTarget = new Map();
  const pelletDirs = [];

  const targets = allCharacters.filter((c) => c !== shooter && c.alive);

  for (let i = 0; i < WEAPON.pelletCount; i++) {
    const yawJitter = (Math.random() * 2 - 1) * halfAngle;
    const pitchJitter = (Math.random() * 2 - 1) * halfAngle * 0.5;
    const yaw = shooter.heading + yawJitter;
    const dir = new THREE.Vector3(Math.sin(yaw), pitchJitter, Math.cos(yaw)).normalize();
    pelletDirs.push(dir);

    let blockDist = Infinity;
    for (const c of colliders) {
      const d = rayAabbDistance(origin.x, origin.z, dir.x, dir.z, c);
      if (d < blockDist) blockDist = d;
    }

    let closestTarget = null;
    let closestDist = Infinity;
    for (const t of targets) {
      const center = { x: t.position.x, y: TARGET_HITBOX_HEIGHT, z: t.position.z };
      const d = raySphereDistance(origin, dir, center, TARGET_HITBOX_RADIUS);
      if (d < closestDist && d <= WEAPON.maxRange) {
        closestDist = d;
        closestTarget = t;
      }
    }

    if (closestTarget && closestDist < blockDist) {
      const dmg = falloffDamage(closestDist);
      hitsByTarget.set(closestTarget, (hitsByTarget.get(closestTarget) || 0) + dmg);
    }
  }

  return { hitsByTarget, origin, pelletDirs };
}
