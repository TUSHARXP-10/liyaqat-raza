import { IntroRenderer } from './introRenderer.js';

// Runs the title sequence on its own thread. The page can build textures,
// compile shaders and lay out the story on the main thread without the
// animation ever missing a frame.

const raf = typeof self.requestAnimationFrame === 'function'
  ? (fn) => self.requestAnimationFrame(fn)
  : (fn) => setTimeout(() => fn(performance.now()), 1000 / 60);

let renderer = null;
let running = false;
let last = 0;
const stats = [];

function loop() {
  if (!running) return;
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  if (renderer.t >= 0 && renderer.t < renderer.T.end) stats.push([+renderer.t.toFixed(3), +(dt * 1000).toFixed(1)]);
  renderer.frame(dt, performance.timeOrigin + now);
  raf(loop);
}

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      renderer = new IntroRenderer(data.canvas, data);
      running = true;
      last = performance.now();
      raf(loop);
      // the logo is sampled and the first frame queued: ready to start the clock
      raf(() => self.postMessage({ type: 'ready' }));
      break;
    case 'start':
      renderer.start(data.startEpoch);
      break;
    case 'resize':
      renderer.resize(data.w, data.h, data.dpr);
      break;
    case 'skip':
      renderer.skip();
      break;
    case 'stats':
      self.postMessage({ type: 'stats', frames: stats.slice() });
      break;
    case 'stop':
      running = false;
      self.close();
      break;
  }
};
