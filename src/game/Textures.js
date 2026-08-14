import * as THREE from 'three';

// All textures are generated at runtime on <canvas> so the game never depends
// on network-fetched art assets — it works fully offline once loaded.

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noise(ctx, w, h, alpha, colorFn) {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < alpha) {
      const [r, g, b] = colorFn();
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(canvas, repeat = [1, 1]) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function sandTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a15f';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.18, () => {
    const v = 170 + Math.random() * 60;
    return [v, v * 0.8, v * 0.5];
  });
  noise(ctx, 256, 256, 0.05, () => [90, 65, 35]);
  const ctx2 = c.getContext('2d');
  ctx2.globalAlpha = 0.08;
  for (let i = 0; i < 40; i++) {
    ctx2.strokeStyle = '#7a5a30';
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    const y = Math.random() * 256;
    ctx2.moveTo(0, y);
    ctx2.bezierCurveTo(80, y + 10, 170, y - 10, 256, y);
    ctx2.stroke();
  }
  ctx2.globalAlpha = 1;
  return toTexture(c, [24, 24]);
}

export function plankTexture(baseColor = '#8a5a3a', dark = '#5b3a24') {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);
  const plankH = 128 / 5;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * plankH);
    ctx.lineTo(128, i * plankH);
    ctx.stroke();
  }
  noise(ctx, 128, 128, 0.12, () => {
    const v = 40 + Math.random() * 30;
    return [v + 90, v + 50, v + 20];
  });
  // grain lines
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    const y = Math.random() * 128;
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + (Math.random() * 6 - 3));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, [2, 2]);
}

export function roofTexture() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d2c22';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#241a14';
  ctx.lineWidth = 2;
  for (let i = 0; i < 128; i += 10) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  return toTexture(c, [3, 3]);
}

export function dirtRoadTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a37c4f';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.2, () => {
    const v = 140 + Math.random() * 50;
    return [v, v * 0.75, v * 0.45];
  });
  ctx.strokeStyle = 'rgba(70,45,20,0.35)';
  for (let i = 0; i < 2; i++) {
    ctx.lineWidth = 10;
    ctx.beginPath();
    const off = i === 0 ? 70 : 180;
    ctx.moveTo(off, 0);
    ctx.bezierCurveTo(off + 10, 90, off - 10, 170, off, 256);
    ctx.stroke();
  }
  return toTexture(c, [10, 40]);
}

export function skyGradientTexture() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#8fc6e8');
  grad.addColorStop(0.45, '#e7c98a');
  grad.addColorStop(0.7, '#e9a86a');
  grad.addColorStop(1, '#c97b52');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function furColorMaterial(hex) {
  const c = makeCanvas(64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 64, 64);
  const base = new THREE.Color(hex);
  noise(ctx, 64, 64, 0.35, () => {
    const v = base.clone().multiplyScalar(0.85 + Math.random() * 0.3);
    return [v.r * 255, v.g * 255, v.b * 255];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
