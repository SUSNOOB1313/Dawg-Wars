import * as THREE from 'three';
import { furColorMaterial } from './Textures.js';

// Builds a stylised low-poly dog rigged with a shotgun clamped in its jaws.
// Returns the root group plus handles to animate (legs, tail, ears, gun).
export function buildDog({ furHex = '#a9702f', bandanaHex = '#b23b3b', label = '' } = {}) {
  const root = new THREE.Group();

  const furTex = furColorMaterial(furHex);
  const furMat = new THREE.MeshStandardMaterial({ map: furTex, roughness: 0.85, metalness: 0.02 });
  const darkFurMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(furHex).multiplyScalar(0.65),
    roughness: 0.9,
  });
  const bandanaMat = new THREE.MeshStandardMaterial({ color: bandanaHex, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#3a3a3d', roughness: 0.35, metalness: 0.75 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.7 });

  const body = new THREE.Group();
  root.add(body);

  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 1.15), furMat);
  torso.position.set(0, 0.72, 0);
  torso.castShadow = true;
  body.add(torso);

  // chest/neck
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.4), furMat);
  chest.position.set(0, 0.78, 0.62);
  chest.castShadow = true;
  body.add(chest);

  // head
  const head = new THREE.Group();
  head.position.set(0, 1.0, 0.95);
  body.add(head);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), furMat);
  skull.castShadow = true;
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.34), furMat);
  snout.position.set(0, -0.06, 0.34);
  snout.castShadow = true;
  head.add(snout);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), darkFurMat);
  nose.position.set(0, -0.05, 0.51);
  head.add(nose);

  const earGeo = new THREE.ConeGeometry(0.14, 0.32, 4);
  const earL = new THREE.Mesh(earGeo, darkFurMat);
  earL.position.set(0.19, 0.28, -0.02);
  earL.rotation.set(0, 0, -0.35);
  head.add(earL);
  const earR = new THREE.Mesh(earGeo, darkFurMat);
  earR.position.set(-0.19, 0.28, -0.02);
  earR.rotation.set(0, 0, 0.35);
  head.add(earR);

  const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.46), bandanaMat);
  bandana.position.set(0, 0.02, 0.02);
  head.add(bandana);

  // eyes
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#161311', roughness: 0.4 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.13, 0.05, 0.2);
  head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(-0.13, 0.05, 0.2);
  head.add(eyeR);

  // legs (upper leg pivots so they can swing)
  const legGeo = new THREE.CylinderGeometry(0.09, 0.075, 0.62, 6);
  const legPositions = {
    frontLeft: [0.24, 0, 0.42],
    frontRight: [-0.24, 0, 0.42],
    backLeft: [0.24, 0, -0.42],
    backRight: [-0.24, 0, -0.42],
  };
  const legs = {};
  for (const [name, [x, , z]] of Object.entries(legPositions)) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.62, z);
    const mesh = new THREE.Mesh(legGeo, darkFurMat);
    mesh.position.set(0, -0.31, 0);
    mesh.castShadow = true;
    pivot.add(mesh);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.19), darkFurMat);
    paw.position.set(0, -0.62, 0.03);
    pivot.add(paw);
    body.add(pivot);
    legs[name] = pivot;
  }

  // tail
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.9, -0.58);
  body.add(tailPivot);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 6), darkFurMat);
  tail.rotation.x = Math.PI / 2.4;
  tail.position.set(0, 0.08, -0.2);
  tailPivot.add(tail);

  // shotgun clamped in jaw, pointing forward (+Z), pivots with head for slight bob
  const gun = new THREE.Group();
  gun.position.set(0, -0.03, 0.5);
  gun.rotation.set(0.02, 0, 0);
  head.add(gun);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.95, 8), metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.05, 0.55);
  gun.add(barrel);

  const barrel2 = barrel.clone();
  barrel2.position.x = 0.045;
  gun.add(barrel2);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.5), woodMat);
  stock.position.set(0.02, 0.02, -0.25);
  gun.add(stock);

  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 8), woodMat);
  pump.rotation.x = Math.PI / 2;
  pump.position.set(0.02, -0.02, 0.32);
  gun.add(pump);

  // muzzle marker (world-space origin for pellet raycasts / flash)
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.05, 1.0);
  gun.add(muzzle);

  const flashLight = new THREE.PointLight(0xffcc66, 0, 4, 2);
  flashLight.position.set(0, 0.05, 1.0);
  gun.add(flashLight);

  root.castShadow = true;
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });

  return {
    root,
    body,
    head,
    legs,
    tail: tailPivot,
    earL,
    earR,
    gun,
    muzzle,
    flashLight,
  };
}
