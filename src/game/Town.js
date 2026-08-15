import * as THREE from 'three';
import { sandTexture, plankTexture, roofTexture, dirtRoadTexture } from './Textures.js';
import { WORLD } from './Constants.js';

// Builds a toy-diorama western town: main street lined with candy-colored
// saloon-style buildings, a windmill, fences, cacti. Cel-shaded (MeshToonMaterial)
// throughout for a bright cartoon look. Returns the group plus a list of
// AABB colliders { minX, maxX, minZ, maxZ } used for movement + line-of-sight blocking.

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeBuilding({ x, z, w, d, h, facing = 0, plankColor, trimColor, hasSign = true }, gradientMap) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;

  const toon = (color, map) => {
    const params = { color, gradientMap: gradientMap || undefined };
    if (map) params.map = map;
    return new THREE.MeshToonMaterial(params);
  };

  const wallMat = toon(0xffffff, plankTexture(plankColor, trimColor));
  const roofMat = toon(0xffffff, roofTexture());
  const trimMat = toon(trimColor);

  const main = box(w, h, d, wallMat);
  main.position.y = h / 2;
  g.add(main);

  // false front parapet (classic western storefront)
  const parapetH = h * 0.42;
  const parapet = box(w * 0.92, parapetH, 0.12, trimMat);
  parapet.position.set(0, h + parapetH / 2 - 0.05, d / 2 + 0.06);
  g.add(parapet);

  // porch roof
  const porchRoof = box(w * 1.05, 0.12, 1.4, roofMat);
  porchRoof.position.set(0, h * 0.62, d / 2 + 0.7);
  g.add(porchRoof);

  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, h * 0.62, 6);
  const postMat = toon('#f2e2c0');
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx * (w / 2 - 0.15), (h * 0.62) / 2, d / 2 + 1.3);
    post.castShadow = true;
    g.add(post);
  }

  // roof cap
  const roof = box(w * 1.02, 0.2, d * 1.02, roofMat);
  roof.position.y = h + 0.1;
  g.add(roof);

  // door + windows (flat dark boxes for contrast)
  const openMat = toon('#3a2a3f');
  const door = box(0.9, 1.7, 0.05, openMat);
  door.position.set(0, 0.85, d / 2 + 0.03);
  g.add(door);
  if (hasSign) {
    const signMat = toon('#fff8ea');
    const sign = box(w * 0.5, 0.5, 0.06, signMat);
    sign.position.set(0, h + parapetH * 0.55, d / 2 + 0.1);
    g.add(sign);
  }

  return { group: g, x, z, w, d, h, facing };
}

function aabbForBuilding(b) {
  // Approximate rotated footprints with axis-aligned bounds (town buildings
  // face the street at 0/PI so this is exact for our layout).
  const cos = Math.abs(Math.cos(b.facing));
  const sin = Math.abs(Math.sin(b.facing));
  const halfW = (b.w * cos + b.d * sin) / 2;
  const halfD = (b.d * cos + b.w * sin) / 2;
  return {
    minX: b.x - halfW - 0.15,
    maxX: b.x + halfW + 0.15,
    minZ: b.z - halfD - 0.15,
    maxZ: b.z + halfD + 0.15,
  };
}

function makeCactus(gradientMap) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: '#5fcf6a', gradientMap: gradientMap || undefined });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.0, 8), mat);
  trunk.position.y = 1.0;
  trunk.castShadow = true;
  g.add(trunk);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.position.y = 2.0;
  cap.castShadow = true;
  g.add(cap);
  for (const [dx, dy, rz, side] of [
    [0.32, 1.15, 0.55, 1],
    [-0.34, 1.45, -0.55, -1],
  ]) {
    const armGroup = new THREE.Group();
    armGroup.position.set(dx, dy, 0);
    armGroup.rotation.z = rz;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.55, 7), mat);
    lower.position.y = 0.27;
    lower.castShadow = true;
    armGroup.add(lower);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 7), mat);
    upper.position.set(side * 0.02, 0.6, 0);
    upper.rotation.z = -rz * 1.5;
    upper.castShadow = true;
    armGroup.add(upper);
    const armCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    armCap.position.set(side * 0.02, 0.95, 0);
    armCap.rotation.z = -rz * 1.5;
    armCap.castShadow = true;
    armGroup.add(armCap);
    g.add(armGroup);
  }
  return g;
}

function makeFencePost(gradientMap) {
  const mat = new THREE.MeshToonMaterial({ color: '#e0a868', gradientMap: gradientMap || undefined });
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5), mat);
  post.position.y = 0.55;
  post.castShadow = true;
  g.add(post);
  return g;
}

function makeWindmill(gradientMap) {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshToonMaterial({ color: '#e0a868', gradientMap: gradientMap || undefined });
  const metalMat = new THREE.MeshToonMaterial({ color: '#e8ecef', gradientMap: gradientMap || undefined });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 6, 8), woodMat);
  tower.position.y = 3;
  tower.castShadow = true;
  g.add(tower);

  const hub = new THREE.Group();
  hub.position.y = 6.1;
  g.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.5), metalMat);
    blade.position.y = 0.8;
    const holder = new THREE.Group();
    holder.rotation.z = (i * Math.PI) / 2;
    holder.add(blade);
    hub.add(holder);
  }
  g.userData.hub = hub;
  return g;
}

export function buildTown(scene, gradientMap = null) {
  const colliders = [];
  const size = WORLD.groundSize;

  // ground
  const groundMat = new THREE.MeshToonMaterial({ map: sandTexture(), gradientMap: gradientMap || undefined });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // main street
  const roadMat = new THREE.MeshToonMaterial({ map: dirtRoadTexture(), gradientMap: gradientMap || undefined });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, size), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  scene.add(road);

  // candy-colored storefronts: pink/salmon and orange/tan alternating, cream/teal accents
  const buildingPalette = [
    { wall: '#f5a8b8', trim: '#d97c8c' },
    { wall: '#f7c07a', trim: '#d99a52' },
    { wall: '#fbe3a3', trim: '#dcb96e' },
    { wall: '#8fd4dc', trim: '#5fa8b0' },
    { wall: '#f2a4d0', trim: '#c96fa0' },
  ];
  const buildingsGroup = new THREE.Group();
  scene.add(buildingsGroup);

  const rowSpecs = [];
  let z = -size / 2 + 14;
  let i = 0;
  while (z < size / 2 - 14) {
    const w = 6 + Math.random() * 3;
    const d = 6 + Math.random() * 2.5;
    const h = 3.2 + Math.random() * 1.6;
    const p1 = buildingPalette[i % buildingPalette.length];
    const p2 = buildingPalette[(i + 2) % buildingPalette.length];
    rowSpecs.push({ x: -7 - w / 2, z, w, d, h, facing: Math.PI / 2, plankColor: p1.wall, trimColor: p1.trim });
    rowSpecs.push({ x: 7 + w / 2, z: z + 4, w, d, h, facing: -Math.PI / 2, plankColor: p2.wall, trimColor: p2.trim });
    z += 13 + Math.random() * 6;
    i++;
  }

  for (const spec of rowSpecs) {
    const b = makeBuilding(spec, gradientMap);
    buildingsGroup.add(b.group);
    colliders.push(aabbForBuilding(b));
  }

  // windmill landmark
  const mill = makeWindmill(gradientMap);
  mill.position.set(-22, 0, size / 2 - 20);
  scene.add(mill);
  colliders.push({ minX: mill.position.x - 0.6, maxX: mill.position.x + 0.6, minZ: mill.position.z - 0.6, maxZ: mill.position.z + 0.6 });

  // scattered cacti + fence posts off the street
  const decor = new THREE.Group();
  for (let n = 0; n < 40; n++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (16 + Math.random() * (size / 2 - 20));
    const zz = (Math.random() - 0.5) * (size - 20);
    if (Math.random() < 0.55) {
      const cactus = makeCactus(gradientMap);
      cactus.position.set(x, 0, zz);
      cactus.rotation.y = Math.random() * Math.PI * 2;
      decor.add(cactus);
      colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: zz - 0.35, maxZ: zz + 0.35 });
    } else {
      const post = makeFencePost(gradientMap);
      post.position.set(x, 0, zz);
      decor.add(post);
    }
  }
  scene.add(decor);

  // invisible boundary walls (keep everyone inside the arena)
  const half = size / 2 - 1;
  colliders.push({ minX: -half - 2, maxX: -half, minZ: -half, maxZ: half });
  colliders.push({ minX: half, maxX: half + 2, minZ: -half, maxZ: half });
  colliders.push({ minX: -half, maxX: half, minZ: -half - 2, maxZ: -half });
  colliders.push({ minX: -half, maxX: half, minZ: half, maxZ: half + 2 });

  return { colliders, arenaHalf: half, mill };
}
