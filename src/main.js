import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import Lenis from 'lenis';

import { Stage } from './three/Stage.js';
import { Director } from './story/Director.js';
import { KEYFRAMES } from './story/keyframes.js';
import { Callouts } from './story/Callouts.js';
import { buildChapters } from './story/chapters.js';
import { Preloader } from './ui/preloader.js';
import { buildBackdrops } from './ui/backdrops.js';
import { initCursor } from './ui/cursor.js';
import { Ambient } from './ui/sound.js';
import { prefersReducedMotion } from './lib/math.js';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin);
ScrollTrigger.config({ ignoreMobileResize: true });

const FONTS = [
  '700 100px "Aref Ruqaa"', '400 100px Cinzel', '500 100px Cinzel', '600 100px Cinzel',
  '300 16px Jost', '400 16px Jost', '500 16px Jost', '400 40px "Pinyon Script"',
  'italic 300 40px "Cormorant Garamond"', '300 40px "Cormorant Garamond"',
];

async function loadFonts() {
  const all = Promise.all(FONTS.map((f) => document.fonts.load(f, f.includes('Aref') ? 'رضا' : 'RAZA Perfume')));
  await Promise.race([all, new Promise((r) => setTimeout(r, 6000))]);
}

async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  const reduced = prefersReducedMotion();

  const pre = new Preloader();
  pre.set('fonts', 0, 1);
  pre.set('stage', 0, 4);
  await loadFonts();
  pre.set('fonts', 1, 1);
  buildBackdrops();

  let stage = null;
  try {
    stage = new Stage(document.querySelector('[data-webgl]'));
    await stage.load((p) => pre.set('stage', p, 4));
  } catch (err) {
    console.warn('[raza] 3D stage unavailable — continuing without WebGL.', err);
    document.documentElement.classList.add('no-webgl');
    stage = null;
    pre.set('stage', 1, 4);
  }

  const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced, wheelMultiplier: 0.9 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const ambient = new Ambient();
  const triggers = {};
  const director = new Director(triggers, KEYFRAMES);
  const story = buildChapters({ stage, lenis, ambient, director, triggers });

  ScrollTrigger.addEventListener('refresh', () => director.refresh());
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  const callouts = stage ? new Callouts(stage) : null;
  initCursor();

  if (stage) {
    window.addEventListener('pointermove', (e) => {
      stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
    window.addEventListener('resize', () => stage.resize());
    gsap.ticker.add((time, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 0.1);
      const state = director.update(window.scrollY, dt, stage.mobile);
      stage.update(state, time, dt, lenis.velocity || 0);
      stage.render();
      callouts.update();
    });
  }

  // debug / QA hook: jump straight in with ?skip
  const skip = new URLSearchParams(location.search).has('skip');
  await pre.complete();
  const mode = skip ? 'silent' : await pre.waitForEnter();
  if (mode === 'sound') story.setSound(true);

  const unlock = () => {
    document.documentElement.classList.remove('is-loading');
    lenis.start();
    ScrollTrigger.refresh();
  };
  if (skip) {
    pre.el.remove();
    story.intro.progress(1);
    unlock();
  } else {
    const reveal = pre.reveal();
    reveal.add(() => story.intro.play(), 1.0);
    reveal.add(unlock, 1.7);
  }

  window.__raza = { lenis, stage, director, ScrollTrigger };
}

boot();
