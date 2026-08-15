import * as THREE from 'three';

// All textures are generated at runtime on <canvas> so the game never depends
// on network-fetched art assets — it works fully offline once loaded.
// Palette + shading target a bright, saturated toy/cartoon look (cel-shaded
// candy town), not photoreal desert grit.

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

// A small quantized ramp for MeshToonMaterial — gives every surface in the
// scene flat, banded cel-shading instead of smooth photoreal falloff.
export function toonGradientTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 1;
  const ctx = c.getContext('2d');
  const shades = [110, 165, 210, 255];
  for (let i = 0; i < shades.length; i++) {
    ctx.fillStyle = `rgb(${shades[i]},${shades[i]},${shades[i]})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function sandTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eab06a';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.1, () => {
    const v = 220 + Math.random() * 25;
    return [v, v * 0.78, v * 0.44];
  });
  noise(ctx, 256, 256, 0.04, () => [201, 140, 76]);
  return toTexture(c, [24, 24]);
}

export function plankTexture(baseColor = '#f2a4b0', dark = '#d97c8c') {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);
  const plankH = 128 / 5;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * plankH);
    ctx.lineTo(128, i * plankH);
    ctx.stroke();
  }
  noise(ctx, 128, 128, 0.06, () => {
    const v = 245 + Math.random() * 10;
    return [v, v * 0.95, v * 0.95];
  });
  return toTexture(c, [2, 2]);
}

export function roofTexture(baseColor = '#c98a4e', dark = '#a06a35') {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 128; i += 12) {
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
  ctx.fillStyle = '#d9a468';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 0.14, () => {
    const v = 225 + Math.random() * 20;
    return [v, v * 0.82, v * 0.55];
  });
  ctx.strokeStyle = 'rgba(160,105,55,0.3)';
  for (let i = 0; i < 2; i++) {
    ctx.lineWidth = 9;
    ctx.beginPath();
    const off = i === 0 ? 70 : 180;
    ctx.moveTo(off, 0);
    ctx.bezierCurveTo(off + 10, 90, off - 10, 170, off, 256);
    ctx.stroke();
  }
  return toTexture(c, [10, 40]);
}

function paintCloud(ctx, x, y, scale) {
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  const lobes = [
    [0, 0, 1],
    [0.55, -0.08, 0.75],
    [-0.5, -0.05, 0.7],
    [0.25, 0.12, 0.65],
    [-0.25, 0.14, 0.6],
  ];
  for (const [lx, ly, lr] of lobes) {
    ctx.beginPath();
    ctx.ellipse(x + lx * scale, y + ly * scale, lr * scale, lr * scale * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // soft cool underside shadow for a bit of dimension
  ctx.fillStyle = 'rgba(150,190,225,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 0.32 * scale, scale * 0.9, scale * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function skyGradientTexture() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#3fa0f0');
  grad.addColorStop(0.5, '#7ec8f5');
  grad.addColorStop(0.78, '#bfe7ff');
  grad.addColorStop(1, '#e9f6ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const clouds = [
    [90, 120, 46],
    [340, 90, 60],
    [420, 200, 38],
    [160, 230, 34],
    [60, 300, 42],
    [300, 330, 50],
    [440, 380, 30],
  ];
  for (const [x, y, s] of clouds) paintCloud(ctx, x, y, s);

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
  // gentle plasticky sheen speckle rather than realistic fur grain
  noise(ctx, 64, 64, 0.15, () => {
    const v = base.clone().multiplyScalar(0.92 + Math.random() * 0.16);
    return [v.r * 255, v.g * 255, v.b * 255];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
