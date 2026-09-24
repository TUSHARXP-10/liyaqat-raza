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
import { Intro } from './ui/intro.js';
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

  const params = new URLSearchParams(location.search);
  const skip = params.has('skip'); // QA hook: no intro at all
  const productId = params.get('p'); // shared product link
  let hashTarget = null;
  try {
    hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null;
  } catch { /* not a valid selector */ }

  // the full title sequence plays on every load, refreshes included
  const ambient = new Ambient();
  const intro = new Intro({
    quick: skip,
    reduced,
    onSound: (on) => (on ? ambient.start() : ambient.stop()),
  });
  intro.set('fonts', 0, 1);
  intro.set('stage', 0, 4);
  intro.set('build', 0, 1);
  // Create the WebGL context before the clock starts: context creation can
  // briefly occupy the GPU, and here it happens on a black screen.
  let stage = null;
  const noWebGL = (err) => {
    console.warn('[raza] 3D stage unavailable — continuing without WebGL.', err);
    document.documentElement.classList.add('no-webgl');
    stage = null;
    intro.set('stage', 1, 4);
  };
  try {
    stage = new Stage(document.querySelector('[data-webgl]'));
  } catch (err) {
    noWebGL(err);
  }
  // the sequence starts as soon as its renderer is ready (logo is vector paths, no fonts needed)
  const fontsReady = loadFonts();
  await intro.start();
  await fontsReady;
  intro.set('fonts', 1, 1);
  buildBackdrops();

  // the site loads while the intro plays
  if (stage) {
    try {
      await stage.load((p) => intro.set('stage', p, 4));
    } catch (err) {
      noWebGL(err);
    }
  }

  const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced, wheelMultiplier: 0.9 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // heavy one-off work (page build, first 3D frames) waits for the intro's
  // calm credits moment so the animation never stutters
  await intro.calm.promise;
  const triggers = {};
  const director = new Director(triggers, KEYFRAMES);
  const story = buildChapters({ stage, lenis, ambient, director, triggers });

  ScrollTrigger.addEventListener('refresh', () => director.refresh());
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  const callouts = stage ? new Callouts(stage) : null;
  initCursor();

  if (stage) {
    // upload textures + first frames while the intro still covers the screen
    await stage.warm();
    window.addEventListener('pointermove', (e) => {
      stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
    window.addEventListener('resize', () => stage.resize());
    gsap.ticker.add((time, deltaMs) => {
      if (stage.hold) return; // nothing to draw under the intro; leave the GPU to it
      const dt = Math.min(deltaMs / 1000, 0.1);
      const state = director.update(window.scrollY, dt, stage.mobile);
      stage.update(state, time, dt, lenis.velocity || 0);
      stage.render();
      callouts.update();
    });
  }

  intro.set('build', 1, 1);
  await intro.finished();
  if (intro.soundOn) story.setSound(true);
  // measure scroll positions now, while covered, not during the curtain
  ScrollTrigger.refresh();

  // pinned chapters sit inside a pin-spacer; aim for its start. The position
  // is measured now (absolute), because the browser may already have jumped
  // to the #hash natively before the pins existed.
  const pinAware = (el) => (el?.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el);
  const jumpTo = (el) => {
    lenis.resize(); // the pins just added page length; don't clamp to the old height
    const y = pinAware(el).getBoundingClientRect().top + window.scrollY;
    lenis.scrollTo(y, { immediate: true, force: true });
  };
  const land = () => {
    if (productId) {
      jumpTo(document.querySelector('#shop'));
      story.shop.view(productId);
    } else if (hashTarget) {
      jumpTo(hashTarget);
    }
  };
  // Everything heavy happens here, while the curtain is still closed; the
  // curtain itself is a CSS transition, so it glides regardless.
  const unlock = () => {
    document.documentElement.classList.remove('is-loading', 'is-covered');
    lenis.start();
    land();
  };
  if (stage) stage.hold = false;
  unlock();
  if (skip) {
    intro.dispose();
    story.intro.progress(1);
  } else {
    intro.reveal();
    setTimeout(() => story.intro.play(), 500);
  }

  window.__raza = { lenis, stage, director, ScrollTrigger };
}

boot();
