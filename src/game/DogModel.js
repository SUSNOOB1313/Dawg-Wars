import * as THREE from 'three';
import { furColorMaterial } from './Textures.js';

// A round, bouncy chibi "blob" dog — big egg-shaped body, floppy ears, big
// simple dot eyes, white mitten paws gripping a shotgun out front, short
// stub legs for a waddly run. Style target: toy-shelf mascot, not a
// realistically-proportioned quadruped.
export function buildDog({ furHex = '#a9702f', bandanaHex = '#b23b3b', gradientMap = null } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // squash/stretch + bob pivot, anchored at ground (y=0)
  root.add(body);

  const furTex = furColorMaterial(furHex);
  const toon = (color, map) => {
    const params = { color, gradientMap: gradientMap || undefined };
    if (map) params.map = map;
    return new THREE.MeshToonMaterial(params);
  };

  const furMat = toon(0xffffff, furTex);
  const darkFurMat = toon(new THREE.Color(furHex).multiplyScalar(0.62));
  const mittMat = toon('#fbf3e2'); // paws are always cream/white, like the reference mascot's gloves
  const bandanaMat = toon(bandanaHex);
  const metalMat = toon('#c9ccd1');
  const woodMat = toon('#d99a52');
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x1a1512 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // ---- main body: one big egg-shaped blob doubles as torso + head ----
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), furMat);
  blob.scale.set(1.0, 1.18, 0.92);
  blob.position.y = 0.74;
  blob.castShadow = true;
  body.add(blob);

  // neck bandana band for per-character color accent
  const bandana = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 8, 16), bandanaMat);
  bandana.rotation.x = Math.PI / 2;
  bandana.position.y = 0.58;
  bandana.scale.set(1, 1, 0.85);
  body.add(bandana);

  // ---- floppy dog ears ----
  const earGeo = new THREE.SphereGeometry(0.19, 10, 8);
  const earL = new THREE.Group();
  earL.position.set(0.34, 1.16, 0.02);
  earL.rotation.set(0.25, 0, 0.95);
  const earLMesh = new THREE.Mesh(earGeo, darkFurMat);
  earLMesh.scale.set(0.5, 1.35, 0.32);
  earLMesh.position.y = -0.14;
  earLMesh.castShadow = true;
  earL.add(earLMesh);
  body.add(earL);

  const earR = new THREE.Group();
  earR.position.set(-0.34, 1.16, 0.02);
  earR.rotation.set(0.25, 0, -0.95);
  const earRMesh = new THREE.Mesh(earGeo, darkFurMat);
  earRMesh.scale.set(0.5, 1.35, 0.32);
  earRMesh.position.y = -0.14;
  earRMesh.castShadow = true;
  earR.add(earRMesh);
  body.add(earR);

  // ---- snout ----
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), furMat);
  snout.scale.set(1, 0.78, 1.05);
  snout.position.set(0, 0.6, 0.42);
  snout.castShadow = true;
  body.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), blackMat);
  nose.position.set(0, 0.6, 0.57);
  body.add(nose);

  // simple curved smile
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10, Math.PI), blackMat);
  mouth.position.set(0, 0.53, 0.55);
  mouth.rotation.z = Math.PI;
  body.add(mouth);

  // ---- big simple dot eyes with tiny highlight sparkle ----
  const eyeGeo = new THREE.CircleGeometry(0.075, 14);
  for (const side of [1, -1]) {
    const eye = new THREE.Mesh(eyeGeo, blackMat);
    eye.position.set(side * 0.17, 0.85, 0.485);
    eye.lookAt(eye.position.x, eye.position.y, eye.position.z + 1);
    body.add(eye);
    const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), whiteMat);
    highlight.position.set(side * 0.17 + 0.02, 0.87, 0.487);
    highlight.lookAt(highlight.position.x, highlight.position.y, highlight.position.z + 1);
    body.add(highlight);
  }

  // ---- mitten arms flanking the shotgun ----
  const armGeo = new THREE.SphereGeometry(0.135, 10, 8);
  const armL = new THREE.Group();
  armL.position.set(0.38, 0.66, 0.28);
  const armLMesh = new THREE.Mesh(armGeo, mittMat);
  armLMesh.scale.set(1, 1, 0.85);
  armLMesh.castShadow = true;
  armL.add(armLMesh);
  body.add(armL);

  const armR = new THREE.Group();
  armR.position.set(-0.38, 0.66, 0.28);
  const armRMesh = new THREE.Mesh(armGeo, mittMat);
  armRMesh.scale.set(1, 1, 0.85);
  armRMesh.castShadow = true;
  armR.add(armRMesh);
  body.add(armR);

  // ---- shotgun, held out front between the mitts ----
  const gun = new THREE.Group();
  gun.position.set(0, 0.63, 0.52);
  body.add(gun);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.7, 8), metalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.022, 0.03, 0.36);
  barrel.castShadow = true;
  gun.add(barrel);
  const barrel2 = barrel.clone();
  barrel2.position.x = -0.022;
  gun.add(barrel2);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.36), woodMat);
  stock.position.set(0, 0, -0.16);
  stock.castShadow = true;
  gun.add(stock);

  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 8), woodMat);
  pump.rotation.x = Math.PI / 2;
  pump.position.set(0, -0.02, 0.24);
  gun.add(pump);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.03, 0.72);
  gun.add(muzzle);

  const flashLight = new THREE.PointLight(0xffcc66, 0, 4, 2);
  flashLight.position.copy(muzzle.position);
  gun.add(flashLight);

  // ---- short stub legs ----
  const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.2, 8);
  const footGeo = new THREE.SphereGeometry(0.115, 8, 6);
  const legL = new THREE.Group();
  legL.position.set(0.22, 0.2, 0);
  const legLMesh = new THREE.Mesh(legGeo, darkFurMat);
  legLMesh.position.y = -0.1;
  legLMesh.castShadow = true;
  legL.add(legLMesh);
  const footL = new THREE.Mesh(footGeo, darkFurMat);
  footL.scale.set(1, 0.6, 1.15);
  footL.position.y = -0.21;
  footL.castShadow = true;
  legL.add(footL);
  body.add(legL);

  const legR = new THREE.Group();
  legR.position.set(-0.22, 0.2, 0);
  const legRMesh = new THREE.Mesh(legGeo, darkFurMat);
  legRMesh.position.y = -0.1;
  legRMesh.castShadow = true;
  legR.add(legRMesh);
  const footR = new THREE.Mesh(footGeo, darkFurMat);
  footR.scale.set(1, 0.6, 1.15);
  footR.position.y = -0.21;
  footR.castShadow = true;
  legR.add(footR);
  body.add(legR);

  // ---- stub tail ----
  const tail = new THREE.Group();
  tail.position.set(0, 0.72, -0.42);
  const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), darkFurMat);
  tailMesh.scale.set(0.85, 0.85, 1.2);
  tailMesh.position.z = -0.06;
  tailMesh.castShadow = true;
  tail.add(tailMesh);
  body.add(tail);

  return {
    root,
    body,
    earL,
    earR,
    armL,
    armR,
    legL,
    legR,
    tail,
    gun,
    muzzle,
    flashLight,
  };
}
