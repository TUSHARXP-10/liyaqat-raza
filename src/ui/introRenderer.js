import { LOGO, drawLogo } from '../brand/logo.js';

// Draws the title sequence: gold particles form the logo → light sweep →
// black hole → flash → afterglow. Pure canvas code with no DOM, so it runs in
// a Web Worker (intro.worker.js, OffscreenCanvas) where nothing the page
// loads can make it stutter, or on the main thread as a fallback.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const outCubic = (k) => 1 - (1 - k) ** 3;
const inCubic = (k) => k * k * k;
const outQuad = (k) => 1 - (1 - k) * (1 - k);

export const TIMINGS = {
  full: { converge: 0.3, crisp: 2.3, sweep: 2.6, hole: 3.35, suck: 3.5, collapse: 4.75, flash: 5.0, since: 5.15, credits: 6.2, end: 7.7 },
  gentle: { converge: 0, crisp: 0.1, sweep: 0.6, hole: 1.6, suck: 1.6, collapse: 1.6, flash: 1.6, since: 1.7, credits: 2.5, end: 4.2 },
};
const GOLDS = ['#fff1c9', '#f0cf88', '#d9a852', '#b8862f'];

const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export class IntroRenderer {
  constructor(canvas, { w, h, dpr, reduced = false, quick = false }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = reduced;
    this.T = reduced ? TIMINGS.gentle : TIMINGS.full;
    this.t = -1; // seconds into the sequence; -1 = not started (dust only)
    this.arcs = Array.from({ length: 26 }, () => ({ a: Math.random() * TAU, len: 0.5 + Math.random() * 1.3 }));
    this.resize(w, h, dpr);
    // prepared up front, so starting the clock costs nothing
    if (!quick) this.buildLogo();
  }

  // startEpoch: wall-clock ms (timeOrigin + now) when the sequence began, so
  // the canvas stays in step with the CSS-driven text on the main thread
  start(startEpoch) {
    if (!this.px) this.buildLogo();
    this.startEpoch = startEpoch;
    this.t = 0;
  }

  skip() {
    this.skipped = true;
  }

  // advance the clock and draw one frame
  frame(dt, epochNow) {
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.t >= 0) {
      this.t = this.skipped ? this.T.end : Math.min(this.T.end, Math.max(0, (epochNow - this.startEpoch) / 1000));
    }
    this.draw(dt);
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = Math.min(dpr || 1, 1.75);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    if (!this.dust) {
      const n = w < 820 ? 80 : 150;
      this.dust = Array.from({ length: n }, () => this.spawnDust({}, true));
    }
    // the logo re-forms at the new size while it is still assembling or holding
    if (this.px && this.t < this.T.hole) this.buildLogo();
  }

  spawnDust(d, anywhere = false) {
    d.x = anywhere ? Math.random() * this.w : (Math.random() < 0.5 ? 0 : this.w);
    d.y = Math.random() * this.h;
    d.vx = (Math.random() - 0.5) * 6;
    d.vy = -4 - Math.random() * 8;
    d.s = 0.6 + Math.random() * 1.4;
    d.a = 0.15 + Math.random() * 0.45;
    return d;
  }

  // Samples the logo into particle targets (grouped by colour, so each frame
  // is one pass per colour) and keeps a crisp gold copy for the hold.
  buildLogo() {
    const aspect = LOGO.height / LOGO.width;
    const W = Math.round(Math.min(this.w * (this.w < 820 ? 0.9 : 0.62), 820, (this.h * 0.62) / aspect));
    const H = Math.round(W * aspect);
    this.lw = W;
    this.lh = H;

    const mask = newCanvas(W, H);
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    drawLogo(mctx, 0, 0, W, '#fff');
    const data = mctx.getImageData(0, 0, W, H).data;
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 140) filled++;
    const want = this.w < 820 ? 1500 : 3000;
    const step = Math.max(1, Math.round(Math.sqrt(filled / want)));
    const byColour = GOLDS.map(() => []);
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) {
          byColour[(Math.random() * GOLDS.length) | 0].push(x - W / 2 + (Math.random() - 0.5) * step, y - H / 2 + (Math.random() - 0.5) * step);
        }
      }
    }
    const pts = byColour.flat();
    const n = pts.length / 2;
    this.ranges = [];
    let start = 0;
    for (const list of byColour) {
      this.ranges.push([start, start + list.length / 2]);
      start += list.length / 2;
    }
    const far = Math.hypot(this.w, this.h) * 0.6;
    let maxR = 1;
    this.n = n;
    this.rt = new Float32Array(n);
    this.tht = new Float32Array(n);
    this.r0 = new Float32Array(n);
    this.th0 = new Float32Array(n);
    this.delay = new Float32Array(n);
    this.suck = new Float32Array(n);
    this.size = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1];
      this.rt[i] = Math.hypot(x, y);
      this.tht[i] = Math.atan2(y, x);
      maxR = Math.max(maxR, this.rt[i]);
      this.r0[i] = far * (0.75 + Math.random() * 0.6);
      this.th0[i] = this.tht[i] - (1.4 + Math.random() * 1.8);
      this.delay[i] = Math.random() * 0.55;
      this.size[i] = 0.9 + Math.random() * 1.3;
    }
    for (let i = 0; i < n; i++) this.suck[i] = (this.rt[i] / maxR) * 0.55 + Math.random() * 0.12;

    const make = () => {
      const c = newCanvas(Math.round(W * this.dpr), Math.round(H * this.dpr));
      const x = c.getContext('2d');
      x.scale(this.dpr, this.dpr);
      return [c, x];
    };
    const [gold, gctx] = make();
    const grad = gctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#93672a');
    grad.addColorStop(0.3, '#f2dca1');
    grad.addColorStop(0.55, '#b5873d');
    grad.addColorStop(0.8, '#f3dea4');
    grad.addColorStop(1, '#9d6f2e');
    // champagne-gold ink, with the logo's own gold details a shade deeper
    drawLogo(gctx, 0, 0, W, { ink: grad, gold: '#c9a45c' });
    this.gold = gold;
    [this.sweepCanvas, this.sweepCtx] = make();
  }

  draw(dt) {
    const { ctx, w, h, T } = this;
    const t = this.t;
    const cx = w / 2;
    const cy = h * 0.46;
    const inHole = t >= T.hole && t < T.flash;
    const trails = !this.reduced && ((t >= T.converge && t < T.crisp) || (t >= T.suck && t < T.flash));

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0,0,0,${trails ? 0.3 : 1})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // slight tremor as the singularity peaks
    if (!this.reduced && t > 4.15 && t < T.flash) {
      const amp = 2.4 * smoothstep(4.15, 4.7, t);
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }

    this.drawDust(dt, inHole && !this.reduced ? smoothstep(T.hole, T.hole + 0.4, t) : 0, cx, cy);
    if (t < 0 || !this.px) return;

    if (this.reduced) {
      const a = smoothstep(0, 0.5, t) * (1 - smoothstep(1.2, 1.6, t));
      this.drawLogo(a, cx, cy);
      return;
    }

    if (t < T.flash) this.drawForming(t, cx, cy);
    const crisp = smoothstep(T.crisp, T.crisp + 0.45, t) * (1 - smoothstep(T.hole, T.hole + 0.25, t));
    if (crisp > 0) this.drawLogo(crisp, cx, cy, t);
    if (inHole) this.drawHole(t, cx, cy);
    if (t >= T.flash) this.drawFlash(t, cx, cy);
  }

  drawDust(dt, pull, cx, cy) {
    const { ctx } = this;
    ctx.fillStyle = '#e8c27a';
    for (const d of this.dust) {
      if (pull > 0) {
        const dx = cx - d.x, dy = cy - d.y;
        const dist = Math.max(20, Math.hypot(dx, dy));
        const f = (pull * 9000) / dist;
        // pulled in and swirled round
        d.vx += (dx / dist) * f * dt - (dy / dist) * f * 0.6 * dt;
        d.vy += (dy / dist) * f * dt + (dx / dist) * f * 0.6 * dt;
        if (dist < 30) this.spawnDust(d);
      } else {
        d.vx *= 0.96;
        d.vy = d.vy * 0.96 - 0.4;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < -10 || d.x < -10 || d.x > this.w + 10 || d.y > this.h + 10) this.spawnDust(d);
      ctx.globalAlpha = d.a;
      ctx.fillRect(d.x, d.y, d.s, d.s);
    }
  }

  // particles spiral in, hold as the logo, then stream into the hole
  drawForming(t, cx, cy) {
    const { ctx, T } = this;
    const sucking = t >= T.suck;
    // while the crisp logo shows, particles dim to a twinkle; they return as it fades
    const holding = smoothstep(T.crisp, T.crisp + 0.45, t) * (1 - smoothstep(T.hole, T.hole + 0.25, t));
    const R = this.holeRadius(t);
    ctx.lineWidth = 1.2;
    this.ranges.forEach(([from, to], b) => {
      ctx.fillStyle = GOLDS[b];
      ctx.strokeStyle = GOLDS[b];
      if (sucking) {
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
      }
      for (let i = from; i < to; i++) {
        let x, y;
        if (!sucking) {
          const k = clamp((t - T.converge - this.delay[i]) / 1.45);
          if (k <= 0) continue;
          const r = lerp(this.r0[i], this.rt[i], outCubic(k));
          const th = lerp(this.th0[i], this.tht[i], outQuad(k));
          x = cx + r * Math.cos(th);
          y = cy + r * Math.sin(th);
          ctx.globalAlpha = holding ? 1 - holding + holding * (0.25 + 0.2 * Math.sin(t * 9 + i)) : 1;
          const s = this.size[i];
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else {
          const k = clamp((t - T.suck - this.suck[i]) / 0.9);
          if (k <= 0) {
            // still waiting its turn: holds its place in the logo
            x = cx + this.rt[i] * Math.cos(this.tht[i]);
            y = cy + this.rt[i] * Math.sin(this.tht[i]);
            const s = this.size[i];
            ctx.fillRect(x - s / 2, y - s / 2, s, s);
          } else {
            const r = this.rt[i] * (1 - inCubic(k));
            const th = this.tht[i] + 6.8 * k * k;
            x = cx + r * Math.cos(th);
            y = cy + r * Math.sin(th);
            if (r > R * 0.95) {
              // streak from last position: stretched by the pull
              ctx.moveTo(this.px[i], this.py[i]);
              ctx.lineTo(x, y);
            }
          }
        }
        this.px[i] = x;
        this.py[i] = y;
      }
      if (sucking) ctx.stroke();
    });
  }

  drawLogo(alpha, cx, cy, t = 0) {
    const { ctx, T, lw, lh } = this;
    let img = this.gold;
    const k = (t - T.sweep) / 0.8;
    if (!this.reduced && k > 0 && k < 1) {
      // a band of light passes over the metal
      const s = this.sweepCtx;
      s.save();
      s.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      s.globalCompositeOperation = 'source-over';
      s.clearRect(0, 0, lw, lh);
      s.drawImage(this.gold, 0, 0, lw, lh);
      s.globalCompositeOperation = 'source-atop';
      const x = lerp(-0.3, 1.3, k) * lw;
      const g = s.createLinearGradient(x - lw * 0.14, 0, x + lw * 0.14, lh * 0.3);
      g.addColorStop(0, 'rgba(255,248,225,0)');
      g.addColorStop(0.5, 'rgba(255,250,235,0.85)');
      g.addColorStop(1, 'rgba(255,248,225,0)');
      s.fillStyle = g;
      s.fillRect(0, 0, lw, lh);
      s.restore();
      img = this.sweepCanvas;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, cx - lw / 2, cy - lh / 2, lw, lh);
    ctx.globalCompositeOperation = 'lighter';
  }

  holeRadius(t) {
    const { T } = this;
    const Rmax = Math.min(this.w, this.h) * 0.085;
    let R = Rmax * outCubic(clamp((t - T.hole) / 0.45));
    if (t > T.collapse) R *= 1 - inCubic(clamp((t - T.collapse) / (T.flash - T.collapse)));
    return R;
  }

  drawHole(t, cx, cy) {
    const { ctx } = this;
    const R = this.holeRadius(t);
    if (R < 0.5) return;
    // lensing glow
    const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 4.4);
    g.addColorStop(0, 'rgba(255,205,130,0.55)');
    g.addColorStop(0.35, 'rgba(214,150,60,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 4.4, 0, TAU);
    ctx.fill();
    // accretion disk: arcs whirling at different speeds
    this.arcs.forEach((arc, j) => {
      const rr = R * (1.12 + j * 0.06);
      const a0 = arc.a + t * (7.5 - j * 0.2);
      ctx.strokeStyle = GOLDS[j % GOLDS.length];
      ctx.globalAlpha = 0.2 + 0.6 * (1 - j / this.arcs.length);
      ctx.lineWidth = 0.8 + (j % 3) * 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a0 + arc.len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0 + Math.PI, a0 + Math.PI + arc.len * 0.6);
      ctx.stroke();
    });
    // photon ring
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.04, 0, TAU);
    ctx.stroke();
    // event horizon
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
  }

  drawFlash(t, cx, cy) {
    const { ctx, T, w, h } = this;
    const k = clamp((t - T.flash) / 0.75);
    const far = Math.hypot(w, h);
    if (k < 1) {
      const r = Math.max(1, outCubic(k) * far * 0.55);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,250,235,${(1 - k) ** 2})`);
      g.addColorStop(0.4, `rgba(240,200,120,${0.5 * (1 - k) ** 2})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(Math.max(0, cx - r), Math.max(0, cy - r), Math.min(w, 2 * r), Math.min(h, 2 * r));
      ctx.strokeStyle = '#f3dea4';
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, outCubic(k) * far * 0.45, 0, TAU);
      ctx.stroke();
    }
    // a warm afterglow where the singularity was (only its own square is filled)
    const gr = Math.min(w, h) * 0.5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    glow.addColorStop(0, `rgba(214,160,80,${0.16 * (1 - smoothstep(T.flash, T.end, t) * 0.6)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
  }
}
