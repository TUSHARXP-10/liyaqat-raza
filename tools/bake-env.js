// Renders the studio environment PMREM once and encodes it as a Radiance
// .hdr (RGBE, run-length encoded). The site loads that file instead of
// generating the PMREM live, which would block the GPU during the intro.
import * as THREE from 'three';
import { studioEnvironmentTarget } from '../src/three/Stage.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c') });
const target = studioEnvironmentTarget(renderer);
const { width: w, height: h } = target;
const half = new Uint16Array(w * h * 4);
renderer.readRenderTargetPixels(target, 0, 0, w, h, half);

// RGBE bytes, rows kept in GL order (bottom-up); the site loads with flipY off
const rgbe = new Uint8Array(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const r = THREE.DataUtils.fromHalfFloat(half[i * 4]);
  const g = THREE.DataUtils.fromHalfFloat(half[i * 4 + 1]);
  const b = THREE.DataUtils.fromHalfFloat(half[i * 4 + 2]);
  const v = Math.max(r, g, b);
  if (!(v > 1e-32)) continue;
  const e = Math.floor(Math.log2(v)) + 1;
  const scale = 256 / 2 ** e;
  rgbe[i * 4] = Math.min(255, r * scale);
  rgbe[i * 4 + 1] = Math.min(255, g * scale);
  rgbe[i * 4 + 2] = Math.min(255, b * scale);
  rgbe[i * 4 + 3] = e + 128;
}

// new-style RLE: per scanline, each channel separately
const out = [];
const push = (...b) => { for (const x of b) out.push(x); };
const line = new Uint8Array(w);
for (let y = 0; y < h; y++) {
  push(2, 2, w >> 8, w & 255);
  for (let c = 0; c < 4; c++) {
    for (let x = 0; x < w; x++) line[x] = rgbe[(y * w + x) * 4 + c];
    let cur = 0;
    while (cur < w) {
      let begRun = cur, runCount = 0, oldRunCount = 0;
      while (runCount < 4 && begRun < w) {
        begRun += runCount;
        oldRunCount = runCount;
        runCount = 1;
        while (begRun + runCount < w && runCount < 127 && line[begRun] === line[begRun + runCount]) runCount++;
      }
      if (oldRunCount > 1 && oldRunCount === begRun - cur) {
        push(128 + oldRunCount, line[cur]);
        cur = begRun;
      }
      while (cur < begRun) {
        const n = Math.min(128, begRun - cur);
        push(n);
        for (let k = 0; k < n; k++) push(line[cur + k]);
        cur += n;
      }
      if (runCount >= 4) {
        push(128 + runCount, line[begRun]);
        cur += runCount;
      }
    }
  }
}

const header = new TextEncoder().encode(`#?RADIANCE\n# Raza Perfume studio PMREM (${w}x${h}, cube UV layout)\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`);
const file = new Uint8Array(header.length + out.length);
file.set(header, 0);
file.set(out, header.length);
let bin = '';
for (let i = 0; i < file.length; i += 0x8000) bin += String.fromCharCode(...file.subarray(i, i + 0x8000));
window.baked = { base64: btoa(bin), w, h };
