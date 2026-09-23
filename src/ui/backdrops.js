import { mulberry32 } from '../lib/noise.js';

// Scenery for the fixed backdrop, generated as SVG so it stays razor sharp
// at any size: Moorish colonnades, a dusk skyline, an Islamic rosette.

const NS = 'http://www.w3.org/2000/svg';
const VB_W = 1600, VB_H = 900;

function el(name, attrs = {}) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Pointed (Moorish) arch opening, drawn clockwise so evenodd cuts it out.
function archOpening(x, w, springY, bottom) {
  const R = w * 0.78;
  const apexY = springY - Math.sqrt(R * R - (R - w / 2) ** 2);
  return `M${x} ${bottom} V${springY} A${R} ${R} 0 0 1 ${x + w / 2} ${apexY} A${R} ${R} 0 0 1 ${x + w} ${springY} V${bottom} Z`;
}

function colonnade(svg, { count, archW, gap, springY, bottom, wallTop, fill, stroke, strokeOpacity, frieze }) {
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  const total = count * archW + (count - 1) * gap;
  const x0 = (VB_W - total) / 2;
  let holes = '';
  for (let i = 0; i < count; i++) holes += archOpening(x0 + i * (archW + gap), archW, springY, bottom);
  svg.appendChild(el('path', { d: `M-400 ${wallTop} H${VB_W + 400} V${VB_H + 10} H-400 Z ${holes}`, fill, 'fill-rule': 'evenodd' }));
  svg.appendChild(el('path', { d: holes, fill: 'none', stroke, 'stroke-opacity': strokeOpacity, 'stroke-width': 1.4 }));
  // inner reveal line — a second, inset outline gives the arches carved depth
  let inner = '';
  for (let i = 0; i < count; i++) inner += archOpening(x0 + i * (archW + gap) + 10, archW - 20, springY + 6, bottom);
  svg.appendChild(el('path', { d: inner, fill: 'none', stroke, 'stroke-opacity': strokeOpacity * 0.45, 'stroke-width': 1 }));
  if (frieze) {
    svg.appendChild(el('line', { x1: -400, x2: VB_W + 400, y1: frieze, y2: frieze, stroke, 'stroke-opacity': strokeOpacity * 0.8 }));
    svg.appendChild(el('line', { x1: -400, x2: VB_W + 400, y1: frieze + 8, y2: frieze + 8, stroke, 'stroke-opacity': strokeOpacity * 0.4 }));
  }
}

function buildArches() {
  const far = document.querySelector('[data-arches="far"]');
  const mid = document.querySelector('[data-arches="mid"]');
  const near = document.querySelector('[data-arches="near"]');
  if (far) colonnade(far, { count: 11, archW: 118, gap: 26, springY: 470, bottom: 760, wallTop: 250, fill: '#1d130b', stroke: '#d9aa5c', strokeOpacity: 0.2, frieze: 300 });
  if (mid) colonnade(mid, { count: 5, archW: 250, gap: 70, springY: 420, bottom: 905, wallTop: 60, fill: '#100a06', stroke: '#d9aa5c', strokeOpacity: 0.26, frieze: 150 });
  if (near) colonnade(near, { count: 1, archW: 1420, gap: 0, springY: 520, bottom: 905, wallTop: -200, fill: '#050302', stroke: '#e0b467', strokeOpacity: 0.3 });
}

function buildSkyline() {
  const layers = [
    { sel: '[data-skyline="far"]', seed: 11, base: 760, minH: 60, maxH: 200, fill: '#3b2213', opacity: 0.85, scale: 0.8 },
    { sel: '[data-skyline="near"]', seed: 29, base: 830, minH: 50, maxH: 170, fill: '#0c0704', opacity: 1, scale: 1.25 },
  ];
  for (const L of layers) {
    const svg = document.querySelector(L.sel);
    if (!svg) continue;
    svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
    const rand = mulberry32(L.seed);
    let d = '';
    let x = -60;
    while (x < VB_W + 60) {
      const t = rand();
      const s = L.scale;
      if (t < 0.22) {
        // minaret
        const cx = x + 14 * s;
        const top = L.base - (L.maxH * 1.15 + rand() * 70) * s;
        const w = 9 * s;
        d += `M${cx - w} ${VB_H} V${top} H${cx + w} V${VB_H} Z`;
        const b1 = top + (L.base - top) * 0.3;
        const b2 = top + 26 * s;
        d += `M${cx - w - 6 * s} ${b1} H${cx + w + 6 * s} V${b1 + 8 * s} H${cx - w - 6 * s} Z`;
        d += `M${cx - w - 4 * s} ${b2} H${cx + w + 4 * s} V${b2 + 6 * s} H${cx - w - 4 * s} Z`;
        d += `M${cx - w} ${top} Q${cx - w} ${top - 22 * s} ${cx} ${top - 44 * s} Q${cx + w} ${top - 22 * s} ${cx + w} ${top} Z`;
        d += `M${cx - 0.8} ${top - 44 * s} V${top - 60 * s} H${cx + 0.8} V${top - 44 * s} Z`;
        x += 34 * s;
      } else if (t < 0.55) {
        // domed hall
        const w = (90 + rand() * 110) * s;
        const h = (L.minH + rand() * (L.maxH - L.minH)) * s;
        const top = L.base - h;
        d += `M${x} ${VB_H} V${top} H${x + w} V${VB_H} Z`;
        const dw = w * (0.55 + rand() * 0.25);
        const dx = x + (w - dw) / 2;
        const dh = dw * (0.55 + rand() * 0.25);
        d += `M${dx} ${top} C${dx - dw * 0.08} ${top - dh * 0.55} ${dx + dw * 0.32} ${top - dh * 0.8} ${dx + dw / 2} ${top - dh} C${dx + dw * 0.68} ${top - dh * 0.8} ${dx + dw * 1.08} ${top - dh * 0.55} ${dx + dw} ${top} Z`;
        d += `M${dx + dw / 2 - 1.2} ${top - dh} V${top - dh - 20 * s} H${dx + dw / 2 + 1.2} V${top - dh} Z`;
        x += w + rand() * 20 * s;
      } else {
        // flat-roofed houses
        const w = (40 + rand() * 90) * s;
        const h = (L.minH * 0.6 + rand() * L.minH) * s;
        d += `M${x} ${VB_H} V${L.base - h} H${x + w} V${VB_H} Z`;
        x += w;
      }
    }
    svg.appendChild(el('path', { d, fill: L.fill, 'fill-opacity': L.opacity }));
    if (L.sel.includes('near')) {
      // the lone figure watching the city — a nod to the founder's journey
      const g = el('g', { fill: '#070403', transform: 'translate(1180 520) scale(1.25)' });
      g.appendChild(el('ellipse', { cx: 22, cy: 18, rx: 11, ry: 13 }));
      g.appendChild(el('path', { d: 'M8 20 Q22 -6 36 20 L40 58 Q22 50 4 58 Z' }));
      g.appendChild(el('path', { d: 'M4 50 Q22 38 40 50 L50 240 Q22 246 -6 240 Z' }));
      svg.appendChild(g);
    }
  }
}

function buildRosette() {
  const svg = document.querySelector('[data-rosette]');
  if (!svg) return;
  const g = el('g', { fill: 'none', stroke: '#d9aa5c', 'stroke-width': 1 });
  const star = (r, n, k, opacity) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a1 = (i / n) * Math.PI * 2, a2 = ((i + k) / n) * Math.PI * 2;
      d += `M${Math.cos(a1) * r} ${Math.sin(a1) * r} L${Math.cos(a2) * r} ${Math.sin(a2) * r} `;
    }
    g.appendChild(el('path', { d, 'stroke-opacity': opacity }));
  };
  [130, 250, 360, 470].forEach((r, i) => g.appendChild(el('circle', { r, 'stroke-opacity': 0.12 - i * 0.02 })));
  star(250, 16, 5, 0.14);
  star(360, 24, 7, 0.09);
  star(470, 32, 9, 0.06);
  star(130, 8, 3, 0.16);
  svg.appendChild(g);
}

export function buildBackdrops() {
  buildArches();
  buildSkyline();
  buildRosette();
}
