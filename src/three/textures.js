import * as THREE from 'three';
import { nextFrame } from '../lib/math.js';
import { paintMarbleBuffers } from './marble.js';
import { drawLogo } from '../brand/logo.js';

// Every surface on the bottle is painted procedurally in canvas: no image
// assets, crisp at any DPR. Each painter can run in three modes:
//   color — albedo (sRGB)
//   pbr   — packed ORM-style map: G = roughness, B = metalness
//   bump  — height for engraving

// CPU-backed canvases: painting them never competes with the intro for the
// GPU, and they upload straight from memory when the textures are initialised.
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function toTexture(canvas, { color = true, wrap = false, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  if (wrap) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.needsUpdate = true;
  return t;
}

function goldGradient(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#f3dd9c');
  g.addColorStop(0.22, '#c1913f');
  g.addColorStop(0.42, '#f1d894');
  g.addColorStop(0.6, '#a9772c');
  g.addColorStop(0.8, '#e7c77f');
  g.addColorStop(1, '#9d6c28');
  return g;
}

export function spacedText(ctx, text, x, y, spacing) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = align;
}

const PBR = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

function palette(ctx, mode, h) {
  if (mode === 'color') {
    return {
      gold: goldGradient(ctx, 0, h),
      groove: '#4a2f0f',
      hi: 'rgba(255,242,205,0.55)',
      black: '#0b0908',
      inlay: goldGradient(ctx, 0, h),
    };
  }
  if (mode === 'pbr') {
    return { gold: PBR(0.24, 1), groove: PBR(0.5, 1), hi: null, black: PBR(0.12, 0), inlay: PBR(0.26, 1) };
  }
  return { gold: '#808080', groove: '#2c2c2c', hi: null, black: '#808080', inlay: '#a6a6a6' };
}

function groove(ctx, pal, pathFn, width = 3) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = pal.groove;
  ctx.lineWidth = width;
  pathFn();
  ctx.stroke();
  if (pal.hi) {
    ctx.save();
    ctx.translate(1.3, 1.3);
    ctx.strokeStyle = pal.hi;
    ctx.lineWidth = Math.max(1, width * 0.35);
    pathFn();
    ctx.stroke();
    ctx.restore();
  }
}

function starPath(ctx, cx, cy, r, points = 8, inner = 0.765, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function brushed(ctx, x, y, w, h, alpha = 0.08) {
  for (let yy = y; yy < y + h; yy += 2) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,245,215' : '60,35,5'},${Math.random() * alpha})`;
    ctx.fillRect(x, yy, w, 1);
  }
}

// Islamic eight-point star lattice, the engraved motif on the cap.
function lattice(ctx, pal, x, y, w, h, cell) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const ox = x + (w - (cols - 1) * cell) / 2;
  const oy = y + (h - (rows - 1) * cell) / 2;
  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const cx = ox + c * cell;
      const cy = oy + r * cell;
      groove(ctx, pal, () => starPath(ctx, cx, cy, cell * 0.42), 2.4);
      groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx, cy, cell * 0.13, 0, Math.PI * 2); }, 1.6);
      // diamond joints between stars
      const dx = cx + cell / 2, dy = cy + cell / 2, d = cell * 0.14;
      groove(ctx, pal, () => {
        ctx.beginPath();
        ctx.moveTo(dx, dy - d); ctx.lineTo(dx + d, dy); ctx.lineTo(dx, dy + d); ctx.lineTo(dx - d, dy); ctx.closePath();
      }, 1.6);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Label */

// entries: a variant name ('BASE'), or a spec for shop renders:
//   { key, line: 'LUXURY COLLECTION', title: 'Nº 07', footer: 'SINCE 1986' }
export async function makeLabelTextures(entries) {
  const W = 1024, H = 1448;
  const specOf = (e) => (typeof e === 'string' ? { key: e, line: 'PREMIUM LUXURY', title: e, footer: 'EAU DE PARFUM' } : e);
  const draw = (ctx, pbr, spec) => {
    const gold = pbr ? PBR(0.3, 1) : goldGradient(ctx, 0, H);
    ctx.fillStyle = pbr ? PBR(0.72, 0) : '#0a0908';
    ctx.fillRect(0, 0, W, H);
    if (!pbr) {
      const v = ctx.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H / 2, H * 0.75);
      v.addColorStop(0, 'rgba(60,45,25,0.35)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(255,235,200,${Math.random() * 0.035})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
      }
    }
    // shrinks the line to fit inside the label's border when it runs long
    const text = (str, font, y, spacing, maxWidth = 860) => {
      ctx.font = font;
      const width = [...str].reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * ([...str].length - 1);
      if (width > maxWidth) {
        const k = maxWidth / width;
        ctx.font = font.replace(/(\d+)px/, (_, px) => `${Math.floor(px * k)}px`);
        spacing *= k;
      }
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      if (!pbr) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        spacedText(ctx, str, W / 2 + 3, y + 3, spacing);
      }
      ctx.fillStyle = gold;
      spacedText(ctx, str, W / 2, y, spacing);
    };

    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.lineWidth = 2;
    ctx.strokeRect(54, 54, W - 108, H - 108);
    ctx.fillStyle = gold;
    [[54, 54], [W - 54, 54], [54, H - 54], [W - 54, H - 54]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 14, y);
      ctx.fill();
    });

    // the brand logo (Raza Perfume NX2) printed in gold foil
    const LW = 780, LX = (W - LW) / 2, LY = 250;
    if (!pbr) drawLogo(ctx, LX + 4, LY + 4, LW, 'rgba(0,0,0,0.9)');
    drawLogo(ctx, LX, LY, LW, pbr ? gold : { ink: gold, gold: '#a87a34' });

    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 170, 800); ctx.lineTo(W / 2 - 22, 800);
    ctx.moveTo(W / 2 + 22, 800); ctx.lineTo(W / 2 + 170, 800);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, 786); ctx.lineTo(W / 2 + 13, 800); ctx.lineTo(W / 2, 814); ctx.lineTo(W / 2 - 13, 800);
    ctx.fill();

    text(spec.line, '400 60px Cinzel', 960, 10);
    text(spec.title, '500 78px Cinzel', 1160, 14);
    text(spec.footer, '400 42px Cinzel', 1240, 9);
  };

  const out = {};
  for (const entry of entries) {
    const spec = specOf(entry);
    const [c1, x1] = makeCanvas(W, H);
    const [c2, x2] = makeCanvas(W, H);
    draw(x1, false, spec);
    draw(x2, true, spec);
    out[spec.key] = { map: toTexture(c1), pbr: toTexture(c2, { color: false }) };
    await nextFrame();
  }
  return out;
}

/* -------------------------------------------------------------------- Cap */

// Side canvas proportion matches an octagon face (0.551 wide x 0.7 tall).
export function makeCapTextures() {
  const W = 2048, H = 330, P = W / 8;
  const side = (mode) => {
    const [c, ctx] = makeCanvas(W, H);
    const pal = palette(ctx, mode, H);
    for (let i = 0; i < 8; i++) {
      const x0 = i * P;
      if (i % 2 === 0) {
        ctx.fillStyle = pal.gold;
        ctx.fillRect(x0, 0, P, H);
        if (mode === 'color') brushed(ctx, x0, 0, P, H, 0.1);
        groove(ctx, pal, () => { ctx.beginPath(); ctx.rect(x0 + 12, 12, P - 24, H - 24); }, 3);
        groove(ctx, pal, () => { ctx.beginPath(); ctx.rect(x0 + 21, 21, P - 42, H - 42); }, 1.8);
        lattice(ctx, pal, x0 + 25, 25, P - 50, H - 50, 46);
      } else {
        ctx.fillStyle = pal.black;
        ctx.fillRect(x0, 0, P, H);
        ctx.strokeStyle = pal.inlay;
        ctx.lineWidth = 3;
        ctx.strokeRect(x0 + 10, 10, P - 20, H - 20);
        if (i === 1 || i === 7) {
          ctx.save();
          ctx.translate(x0 + P / 2, H / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = pal.inlay;
          ctx.font = '500 40px Cinzel';
          ctx.textBaseline = 'middle';
          spacedText(ctx, 'RAZA', 0, 2, 12);
          ctx.restore();
        }
      }
    }
    return c;
  };

  const top = (mode) => {
    const S = 512;
    const [c, ctx] = makeCanvas(S, S);
    const pal = palette(ctx, mode, S);
    ctx.fillStyle = pal.gold;
    ctx.fillRect(0, 0, S, S);
    if (mode === 'color') {
      const g = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(255,240,200,0.35)');
      g.addColorStop(1, 'rgba(90,55,10,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    const cx = S / 2, cy = S / 2;
    [236, 222, 150].forEach((r, i) => groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); }, i === 1 ? 1.6 : 3));
    // sixteen-point interlaced rosette
    groove(ctx, pal, () => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a1 = (i / 16) * Math.PI * 2, a2 = ((i + 5) / 16) * Math.PI * 2;
        ctx.moveTo(cx + Math.cos(a1) * 130, cy + Math.sin(a1) * 130);
        ctx.lineTo(cx + Math.cos(a2) * 130, cy + Math.sin(a2) * 130);
      }
    }, 2.2);
    groove(ctx, pal, () => starPath(ctx, cx, cy, 58), 2.4);
    groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); }, 2);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      groove(ctx, pal, () => starPath(ctx, cx + Math.cos(a) * 186, cy + Math.sin(a) * 186, 22, 8, 0.765, a), 1.8);
    }
    return c;
  };

  return {
    side: {
      map: toTexture(side('color')),
      pbr: toTexture(side('pbr'), { color: false }),
      bump: toTexture(side('bump'), { color: false }),
    },
    top: {
      map: toTexture(top('color')),
      pbr: toTexture(top('pbr'), { color: false }),
      bump: toTexture(top('bump'), { color: false }),
    },
  };
}

/* ------------------------------------------------------------------- Coin */

export function makeCoinTextures() {
  const S = 512;
  const draw = (mode) => {
    const [c, ctx] = makeCanvas(S, S);
    const pal = palette(ctx, mode, S);
    ctx.fillStyle = pal.gold;
    ctx.fillRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    if (mode === 'color') {
      const g = ctx.createRadialGradient(cx - 60, cy - 80, 10, cx, cy, S / 2);
      g.addColorStop(0, 'rgba(255,245,210,0.45)');
      g.addColorStop(1, 'rgba(80,45,5,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
    groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx, cy, 238, 0, Math.PI * 2); }, 4);
    groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); }, 2);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      groove(ctx, pal, () => { ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 219, cy + Math.sin(a) * 219, 3, 0, Math.PI * 2); }, 2);
    }
    ctx.font = '600 280px Cinzel';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'color') {
      ctx.fillStyle = 'rgba(60,35,5,0.85)';
      ctx.fillText('R', cx + 6, cy + 20);
      ctx.fillStyle = 'rgba(255,245,215,0.9)';
      ctx.fillText('R', cx - 3, cy + 11);
      ctx.fillStyle = goldGradient(ctx, cy - 140, cy + 140);
      ctx.fillText('R', cx, cy + 14);
    } else if (mode === 'bump') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText('R', cx, cy + 14);
    } else {
      ctx.fillStyle = PBR(0.16, 1);
      ctx.fillText('R', cx, cy + 14);
    }
    return c;
  };
  return {
    map: toTexture(draw('color')),
    pbr: toTexture(draw('pbr'), { color: false }),
    bump: toTexture(draw('bump'), { color: false }),
  };
}

/* ----------------------------------------------------------------- Marble */

// Black marble with fractured gold veins. The per-pixel maths runs in a Web
// Worker so the intro keeps animating; main-thread fallback if workers fail.
function marbleOnWorker(spec, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./marble.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.done) {
        worker.terminate();
        resolve(data);
      } else onProgress(data.progress);
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage(spec);
  });
}

// rare fallback (workers blocked): paint in one go
async function marbleOnMainThread(spec, onProgress) {
  await nextFrame();
  const buffers = paintMarbleBuffers(spec);
  onProgress(1);
  return buffers;
}

async function paintMarble(seed, w, h, pxPerUnit, seedOffset, onProgress) {
  const spec = { seed, w, h, pxPerUnit, seedOffset };
  let buffers;
  try {
    buffers = await marbleOnWorker(spec, onProgress);
  } catch {
    buffers = await marbleOnMainThread(spec, onProgress);
  }
  const [c, ctx] = makeCanvas(w, h);
  const [cp, ctxp] = makeCanvas(w, h);
  ctx.putImageData(new ImageData(buffers.color, w, h), 0, 0);
  ctxp.putImageData(new ImageData(buffers.pbr, w, h), 0, 0);
  return [c, ctx, cp, ctxp];
}

export async function makeMarbleTextures(seed, onProgress = () => {}) {
  // side: octagon with 8 faces 1.19 wide, 0.7 tall -> keep texels square
  const SW = 3072, SH = 225, P = SW / 8;
  // side and top paint in parallel on two workers
  let pSide = 0, pTop = 0;
  const report = () => onProgress(pSide * 0.7 + pTop * 0.3);
  const [[side, sctx, sideP, sctxp], [top, , topP]] = await Promise.all([
    paintMarble(seed, SW, SH, 322, 0, (p) => { pSide = p; report(); }),
    paintMarble(seed, 512, 512, 165, 17.3, (p) => { pTop = p; report(); }),
  ]);

  // engraved RAZA on the front face
  const engrave = (ctx, pbr) => {
    ctx.font = '500 92px Cinzel';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    if (!pbr) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      spacedText(ctx, 'RAZA', P / 2 + 3, SH / 2 + 7, 17);
      ctx.fillStyle = goldGradient(ctx, SH / 2 - 46, SH / 2 + 46);
    } else {
      ctx.fillStyle = PBR(0.22, 1);
    }
    spacedText(ctx, 'RAZA', P / 2, SH / 2 + 4, 17);
  };
  engrave(sctx, false);
  engrave(sctxp, true);

  onProgress(1);
  return {
    side: { map: toTexture(side), pbr: toTexture(sideP, { color: false }) },
    top: { map: toTexture(top), pbr: toTexture(topP, { color: false }) },
  };
}

/* ------------------------------------------------------- Liquid & sprites */

export function makeSwirlTexture(noise) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / 64, v = y / 64;
      const qx = noise.fbm3(u, v, 0.2, 3), qy = noise.fbm3(u + 5.2, v + 1.3, 0.2, 3);
      const n = noise.fbm3(u + 3 * qx, v + 3 * qy, 1.4, 4) * 0.5 + 0.5;
      const val = Math.pow(n, 1.6) * 255 * 1.4;
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, 70 + val);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, { color: false, wrap: true });
}

export function makeGlowTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}
