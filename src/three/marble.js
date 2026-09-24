import { createNoise } from '../lib/noise.js';

// Black marble with fractured gold veins, painted pixel by pixel into RGBA
// buffers: `color` (albedo) and `pbr` (G = roughness, B = metalness).
// Pure maths, so it runs in a Web Worker (marble.worker.js) or, as a
// fallback, on the main thread.
export function paintMarbleBuffers({ seed, w, h, pxPerUnit, seedOffset }, onRow = () => {}) {
  const noise = createNoise(seed);
  const color = new Uint8ClampedArray(w * h * 4);
  const pbr = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = x / pxPerUnit + seedOffset, wy = y / pxPerUnit;
      const n = noise.fbm3(wx * 1.1, wy * 1.1, 0.3, 5);
      const cloud = noise.fbm3(wx * 0.6 + 9, wy * 0.6, 1.7, 3);
      const v1 = Math.abs(Math.sin((wx * 0.9 + wy * 1.7 + n * 3.4) * 2.6));
      const vein1 = 1 - Math.min(1, v1 / 0.05);
      const crack = Math.abs(noise.noise3(wx * 2.4, wy * 2.4, 3.1) + n * 0.25);
      const vein2 = 1 - Math.min(1, crack / 0.022);
      const hair = Math.abs(noise.noise3(wx * 5.5, wy * 5.5, 7.7));
      const vein3 = (1 - Math.min(1, hair / 0.012)) * 0.45;
      let gold = Math.max(vein1 * 0.95, vein2 * 0.8, vein3);
      gold *= 0.55 + 0.45 * (noise.noise3(wx * 3, wy * 3, 5) * 0.5 + 0.5);
      const base = 10 + 16 * (n * 0.5 + 0.5) + 26 * Math.max(0, cloud) ** 2;
      const i = (y * w + x) * 4;
      color[i] = base * 1.02 + (214 - base) * gold;
      color[i + 1] = base + (160 - base) * gold;
      color[i + 2] = base * 0.94 + (78 - base) * gold;
      color[i + 3] = 255;
      pbr[i + 1] = 255 * (0.42 - 0.14 * gold);
      pbr[i + 2] = 255 * Math.min(1, gold * 1.4);
      pbr[i + 3] = 255;
    }
    onRow(y, h);
  }
  return { color, pbr };
}
