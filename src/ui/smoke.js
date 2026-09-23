// Incense smoke rising from the founder's burner. Canvas 2D particles with a
// cached soft sprite; only runs while the burner is on screen.

export class Smoke {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.running = false;
    this.sprite = this.#sprite();
    this.last = 0;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop())).observe(canvas);
  }

  #sprite() {
    const s = document.createElement('canvas');
    s.width = s.height = 128;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(235,215,185,0.55)');
    g.addColorStop(0.5, 'rgba(210,180,140,0.18)');
    g.addColorStop(1, 'rgba(200,170,130,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    return s;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.max(1, r.width * pr);
    this.canvas.height = Math.max(1, r.height * pr);
    this.ctx.setTransform(pr, 0, 0, pr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this.tick(Math.min(0.05, (now - this.last) / 1000), now / 1000);
      this.last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  tick(dt, t) {
    const { ctx, w, h } = this;
    if (this.particles.length < 70 && Math.random() < 0.6) {
      this.particles.push({
        x: w / 2 + (Math.random() - 0.5) * 6,
        y: h - 4,
        vx: (Math.random() - 0.5) * 6,
        vy: -(26 + Math.random() * 22),
        size: 10 + Math.random() * 10,
        life: 0,
        max: 4.5 + Math.random() * 3,
        seed: Math.random() * 100,
      });
    }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      const k = p.life / p.max;
      if (k >= 1) return false;
      const sway = Math.sin(t * 0.8 + p.seed + k * 5) * 18 * k + Math.sin(t * 1.7 + p.seed * 2) * 6 * k;
      p.x += (p.vx + sway * 0.6) * dt;
      p.y += p.vy * dt;
      p.vy *= 0.998;
      const s = p.size * (1 + k * 5);
      ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, k * 1.2)) * 0.22 * (1 - k * 0.6);
      ctx.drawImage(this.sprite, p.x - s / 2, p.y - s / 2, s, s);
      return true;
    });
    ctx.globalAlpha = 1;
  }
}
