import * as THREE from 'three';
import { clamp, smoothstep } from '../lib/math.js';

// Anatomy labels pinned to the real 3D parts: every frame each part's anchor
// is projected to the screen and its label + leader line follow it.

const NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

export class Callouts {
  constructor(stage) {
    this.stage = stage;
    this.root = document.querySelector('[data-callouts]');
    this.lines = document.querySelector('[data-callout-lines]');
    this.now = document.querySelector('[data-anatomy-now]');
    this.center = new THREE.Vector3();
    this.lastCount = -1;
    this.items = stage.bottle.anchors.map((a) => {
      const el = this.root.querySelector(`[data-callout="${a.key}"]`);
      const line = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0 });
      const pulse = svg('circle', { r: 6, class: 'pulse', cx: 0, cy: 0 });
      const dot = svg('circle', { r: 2.6, class: 'dot', cx: 0, cy: 0 });
      this.lines.append(line, pulse, dot);
      return { ...a, el, line, dot, pulse };
    });
  }

  update() {
    if (!this.root.classList.contains('is-on')) return;
    const { stage } = this;
    const mobile = window.innerWidth < 820;
    this.root.classList.toggle('is-mobile', mobile);
    const bottle = stage.bottle;
    const e = bottle.explode;

    const alphas = this.items.map((it) => {
      const k = it.key === 'bottle' ? smoothstep(0.3, 0.62, e) : bottle.partProgress[it.key];
      return smoothstep(0.35, 0.85, k);
    });
    const count = alphas.filter((a) => a > 0.5).length;
    if (count !== this.lastCount) {
      this.now.textContent = String(count).padStart(2, '0');
      this.lastCount = count;
    }

    const center = stage.projectPoint(bottle.root.getWorldPosition(this.center));
    const baseItem = this.items.find((i) => i.key === 'base');
    const basePt = stage.project(baseItem);
    const colOffset = Math.max(150, Math.abs(basePt.x - center.x) + 56);
    const W = 250;
    const H = stage.size.h;
    const captionY = H * 0.79;
    const active = mobile ? alphas.reduce((acc, a, i) => (a > 0.5 ? i : acc), -1) : -1;

    this.items.forEach((it, i) => {
      const pt = stage.project(it);
      const alpha = alphas[i];
      if (mobile) {
        const on = i === active;
        it.el.style.transform = `translate3d(20px, ${captionY}px, 0)`;
        it.el.style.opacity = on ? 1 : 0;
        const show = on ? 1 : 0;
        this.#line(it, stage.size.w / 2, captionY - 14, pt.x, pt.y, show, show);
        return;
      }
      const left = it.side === 'left';
      const edgeX = left ? center.x - colOffset : center.x + colOffset;
      const lx = left ? edgeX - W : edgeX;
      it.el.style.transform = `translate3d(${lx.toFixed(1)}px, ${(pt.y - 13).toFixed(1)}px, 0)`;
      it.el.style.opacity = alpha.toFixed(3);
      const x1 = left ? edgeX + 14 : edgeX - 14;
      const x2 = left ? pt.x - 7 : pt.x + 7;
      const draw = clamp(alpha * 1.25);
      this.#line(it, x1, pt.y, x1 + (x2 - x1) * draw, pt.y, alpha > 0.01 ? 1 : 0, draw >= 1 ? alpha : 0, pt);
    });
  }

  #line(it, x1, y1, x2, y2, lineOpacity, dotOpacity, pt = { x: x2, y: y2 }) {
    const { line, dot, pulse } = it;
    line.setAttribute('x1', x1.toFixed(1));
    line.setAttribute('y1', y1.toFixed(1));
    line.setAttribute('x2', x2.toFixed(1));
    line.setAttribute('y2', y2.toFixed(1));
    line.style.opacity = lineOpacity;
    for (const c of [dot, pulse]) {
      c.setAttribute('cx', pt.x.toFixed(1));
      c.setAttribute('cy', pt.y.toFixed(1));
      c.style.opacity = dotOpacity;
      c.style.visibility = dotOpacity > 0.01 ? 'visible' : 'hidden';
    }
  }
}
