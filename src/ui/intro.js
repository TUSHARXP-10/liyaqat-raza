import { IntroRenderer, TIMINGS } from './introRenderer.js';

// Opening title sequence (~7.7 s), played while the site loads behind it:
//   gold particles form the logo → light sweep → a black hole swallows it →
//   flash → "Since 1986 · razaperfume.com" → license credit → curtain opens.
//
// Smoothness by design: the canvas animation runs in a Web Worker
// (OffscreenCanvas), and every text fade and the curtain are CSS animations,
// which the browser runs off the main thread. So building textures, compiling
// shaders or laying out the page can never make the intro stutter.

const $ = (s, r = document) => r.querySelector(s);
const wall = () => performance.timeOrigin + performance.now();

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

export class Intro {
  constructor({ quick = false, reduced = false, onSound = () => {} } = {}) {
    this.el = $('[data-intro]');
    this.canvas = $('[data-intro-canvas]', this.el);
    this.quick = quick;
    this.reduced = reduced;
    this.T = reduced ? TIMINGS.gentle : TIMINGS.full;
    this.onSound = onSound;
    this.soundOn = false;
    this.parts = {};
    this.target = 0;
    this.startedAt = null;
    this.calm = deferred();
    this.timelineDone = deferred();
    this.loaded = deferred();
    this.ready = deferred();

    if (quick) {
      this.el.classList.add('is-quick', 'is-waiting');
      this.calm.resolve();
      this.timelineDone.resolve();
    }

    // CSS timeline: the text beats are keyed off the same clock as the canvas
    const T = this.T;
    const vars = {
      '--t-ui': 0.8, '--t-since': T.since, '--t-domain': T.since + 0.4,
      '--t-label': T.credits, '--t-built': T.credits + 0.12, '--t-studio': T.credits + 0.22, '--t-rights': T.credits + 0.5,
    };
    for (const [k, v] of Object.entries(vars)) this.el.style.setProperty(k, `${v}s`);

    const soundBtn = $('[data-intro-sound]', this.el);
    soundBtn.addEventListener('click', () => {
      this.soundOn = !this.soundOn;
      soundBtn.setAttribute('aria-pressed', this.soundOn);
      soundBtn.classList.toggle('is-on', this.soundOn);
      $('[data-intro-sound-label]', soundBtn).textContent = this.soundOn ? 'Sound on' : 'Sound off';
      this.onSound(this.soundOn);
    });
    $('[data-intro-skip]', this.el).addEventListener('click', () => this.skip());

    this.#startRenderer();
    this.onResize = () => {
      const size = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 };
      if (this.worker) this.worker.postMessage({ type: 'resize', ...size });
      else this.renderer?.resize(size.w, size.h, size.dpr);
    };
    window.addEventListener('resize', this.onResize);
    window.__razaIntro = this; // QA hook
  }

  // Worker + OffscreenCanvas where supported; same renderer on the main thread otherwise.
  #startRenderer() {
    const init = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, reduced: this.reduced, quick: this.quick };
    if ('transferControlToOffscreen' in HTMLCanvasElement.prototype && typeof Worker !== 'undefined') {
      try {
        const offscreen = this.canvas.transferControlToOffscreen();
        this.worker = new Worker(new URL('./intro.worker.js', import.meta.url), { type: 'module' });
        this.worker.addEventListener('message', ({ data }) => data.type === 'ready' && this.ready.resolve());
        this.worker.addEventListener('error', () => this.ready.resolve());
        this.worker.postMessage({ type: 'init', canvas: offscreen, ...init }, [offscreen]);
        // never hold the page hostage to a slow worker start
        setTimeout(() => this.ready.resolve(), 1500);
        return;
      } catch (err) {
        console.warn('[raza] intro worker unavailable, drawing on the main thread', err);
        this.worker = null;
      }
    }
    this.renderer = new IntroRenderer(this.canvas, init);
    this.ready.resolve();
    let last = performance.now();
    const loop = (now) => {
      if (!this.renderer) return;
      this.renderer.frame((now - last) / 1000, wall());
      last = now;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // seconds into the sequence (for QA scripts); -1 before it starts
  get t() {
    if (this.startedAt === null) return -1;
    if (this.skipped) return this.T.end;
    return Math.min(this.T.end, (wall() - this.startedAt) / 1000);
  }

  /* ------------------------------------------------------------ loading */

  set(key, value, weight = 1) {
    this.parts[key] = { value, weight };
    const all = Object.values(this.parts);
    this.target = all.reduce((a, p) => a + p.value * p.weight, 0) / all.reduce((a, p) => a + p.weight, 0);
    // the bar eases via a CSS transition; only visible if loading outlasts the intro
    $('[data-intro-bar]', this.el).style.transform = `scaleX(${this.target.toFixed(3)})`;
    $('[data-intro-pct]', this.el).textContent = `${Math.round(this.target * 100)}%`;
    if (this.target >= 1) this.loaded.resolve();
  }

  // resolves when the sequence has played (or was skipped) AND the site is loaded
  async finished() {
    await this.timelineDone.promise;
    if (this.target < 1) {
      this.el.classList.add('is-waiting');
      await this.loaded.promise;
      await new Promise((r) => setTimeout(r, 450)); // let the bar visibly fill
    }
  }

  /* ----------------------------------------------------------- sequence */

  // starts the clock once the renderer is ready (logo prepared, first frame up)
  async start() {
    if (this.quick) return;
    await this.ready.promise;
    this.startedAt = wall();
    if (this.worker) this.worker.postMessage({ type: 'start', startEpoch: this.startedAt });
    else this.renderer.start(this.startedAt);
    this.el.classList.add('is-playing');
    this.calmTimer = setTimeout(() => this.calm.resolve(), (this.T.credits + 0.1) * 1000);
    this.endTimer = setTimeout(() => this.finishTimeline(), this.T.end * 1000);
  }

  finishTimeline() {
    this.calm.resolve();
    this.timelineDone.resolve();
  }

  skip() {
    if (this.startedAt === null || this.skipped) return;
    this.skipped = true;
    this.el.classList.add('is-skipped');
    if (this.worker) this.worker.postMessage({ type: 'skip' });
    else this.renderer.skip();
    clearTimeout(this.calmTimer);
    clearTimeout(this.endTimer);
    this.finishTimeline();
  }

  // frame-time stats from the worker (QA)
  stats() {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const onMsg = ({ data }) => {
        if (data.type !== 'stats') return;
        this.worker.removeEventListener('message', onMsg);
        resolve(data.frames);
      };
      this.worker.addEventListener('message', onMsg);
      this.worker.postMessage({ type: 'stats' });
    });
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer = null;
    this.worker?.postMessage({ type: 'stop' });
    this.worker = null;
    window.removeEventListener('resize', this.onResize);
    this.el.remove();
  }

  // Curtain: CSS transitions (compositor-driven). Resolves when fully open.
  reveal() {
    this.el.classList.add('is-revealing');
    return new Promise((resolve) => setTimeout(() => {
      this.dispose();
      resolve();
    }, 1750));
  }
}
