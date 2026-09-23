import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Odometer } from '../ui/odometer.js';
import { Smoke } from '../ui/smoke.js';
import { heroState } from './keyframes.js';

// Every chapter's choreography. Pinned chapters scrub their timelines with
// scroll; the 3D bottle is driven separately by the Director (keyframes.js)
// off the same ScrollTriggers, so text and object always stay in sync.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isMobile = () => window.innerWidth < 820;
const TAU = Math.PI * 2;

export function buildChapters(ctx) {
  const intro = setupHero(ctx);
  setupAnatomy(ctx);
  setupStory(ctx);
  setupFounder(ctx);
  setupCollection(ctx);
  setupPromise(ctx);
  setupJourney();
  setupBackdropFades();
  const { setSound } = setupChrome(ctx);
  return { intro, setSound };
}

/* ------------------------------------------------------------------- HERO */

function setupHero({ stage, triggers: T, director, ambient }) {
  const slides = $$('[data-hero-slide]');
  const chars = slides.map((s) => SplitText.create(s.querySelectorAll('.hero__line'), { type: 'words,chars' }).chars);
  const lead = SplitText.create('[data-hero-lead]', { type: 'lines', mask: 'lines' }).lines;
  const eyebrow = $('[data-hero-eyebrow]');
  const pager = $$('[data-hero-go]');
  const bars = pager.map((b) => b.querySelector('b'));
  const labels = ['Base — The Original Essence', 'Oud — Rich. Bold. Timeless.', 'Musk — Pure. Elegant. Everlasting.'];
  gsap.set([chars[1], chars[2]], { yPercent: 110 });

  let index = 0;
  let paused = true;
  let progress = null;

  const run = () => {
    progress?.kill();
    gsap.set(bars, { scaleX: 0 });
    progress = gsap.fromTo(bars[index], { scaleX: 0 }, { scaleX: 1, duration: 7, ease: 'none', onComplete: () => go((index + 1) % slides.length) });
    if (paused) progress.pause();
  };

  function go(i) {
    if (i === index) return;
    const prev = index;
    index = i;
    gsap.to(chars[prev], {
      yPercent: -110, duration: 0.7, stagger: 0.012, ease: 'power3.in', overwrite: true,
      onComplete: () => index !== prev && slides[prev].classList.remove('is-active'),
    });
    slides[i].classList.add('is-active');
    gsap.fromTo(chars[i], { yPercent: 110 }, { yPercent: 0, duration: 1.3, stagger: 0.022, ease: 'expo.out', delay: 0.45, overwrite: true });
    gsap.to(eyebrow, {
      autoAlpha: 0, y: -8, duration: 0.35, overwrite: true,
      onComplete: () => {
        eyebrow.textContent = labels[i];
        gsap.fromTo(eyebrow, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7 });
      },
    });
    pager.forEach((b, k) => {
      b.classList.toggle('is-active', k === i);
      b.setAttribute('aria-selected', k === i);
    });
    gsap.to(heroState, { variant: i, duration: 1.8, ease: 'power2.inOut', overwrite: true });
    gsap.to(director.extra, { ry: `+=${TAU}`, duration: 2.2, ease: 'power3.inOut' });
    ambient.swell();
    run();
  }

  pager.forEach((b, i) => b.addEventListener('click', () => go(i)));

  T.hero = ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: 'bottom top',
    onLeave: () => { paused = true; progress?.pause(); },
    onEnterBack: () => { paused = false; progress?.resume(); },
  });

  const out = { trigger: '#hero', start: 'top top', end: 'bottom 20%', scrub: true };
  gsap.to('[data-hero-content]', { y: () => -innerHeight * 0.18, autoAlpha: 0, ease: 'none', scrollTrigger: out });
  gsap.to('[data-hero-aside]', { y: -140, autoAlpha: 0, ease: 'none', scrollTrigger: { ...out } });
  gsap.to('[data-hero-scroll]', { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: '12% top', scrub: true } });
  gsap.to('[data-arches="near"]', { scale: 1.25, yPercent: 10, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('[data-arches="mid"]', { scale: 1.12, yPercent: 5, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });

  // the entrance, played once the curtain opens
  const tl = gsap.timeline({ paused: true });
  if (stage) tl.to(stage, { intro: 1, duration: 3.6, ease: 'expo.out' }, 0);
  tl.from('.nav > *', { yPercent: -120, autoAlpha: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out' }, 0.6)
    .fromTo(chars[0], { yPercent: 115 }, { yPercent: 0, duration: 1.6, stagger: 0.03, ease: 'expo.out', immediateRender: true }, 0.35)
    .from('.hero__eyebrow', { autoAlpha: 0, x: -30, duration: 1.2, ease: 'expo.out' }, 0.9)
    .from(lead, { yPercent: 100, duration: 1.2, stagger: 0.08, ease: 'expo.out' }, 1.0)
    .from('[data-hero-cta] > *', { autoAlpha: 0, y: 30, duration: 1.2, ease: 'expo.out' }, 1.2)
    .from(pager, { autoAlpha: 0, y: 20, stagger: 0.08, duration: 1, ease: 'expo.out' }, 1.3)
    .from('[data-hero-aside] span', { autoAlpha: 0, y: 20, stagger: 0.1, duration: 1.2, ease: 'expo.out' }, 1.4)
    .from('[data-hero-scroll] > *, .chapters > a, .sound', { autoAlpha: 0, duration: 1.4, stagger: 0.04 }, 1.8)
    .add(() => { paused = false; run(); }, 2.4);
  return tl;
}

/* ---------------------------------------------------------------- ANATOMY */

function setupAnatomy({ triggers: T, ambient }) {
  const title = SplitText.create('#anatomy .display__line', { type: 'words,chars' }).chars;
  const lead = SplitText.create('#anatomy [data-split-lines]', { type: 'lines', mask: 'lines' }).lines;
  const callouts = $('[data-callouts]');

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#anatomy', start: 'top top', end: '+=380%', pin: true, scrub: 1, anticipatePin: 1,
      onToggle: (self) => callouts.classList.toggle('is-on', self.isActive),
    },
  });
  T.anatomy = tl.scrollTrigger;

  tl.from(title, { yPercent: 120, rotate: 6, stagger: 0.004, duration: 0.06, ease: 'power3.out' }, 0)
    .from('[data-anatomy-rule]', { scaleX: 0, duration: 0.05 }, 0.05)
    .from(lead, { yPercent: 100, stagger: 0.01, duration: 0.05, ease: 'power3.out' }, 0.06)
    .to('[data-anatomy-hint]', { autoAlpha: 1, duration: 0.04 }, 0.1)
    .to('[data-anatomy-hint]', { autoAlpha: 0, duration: 0.04 }, 0.3)
    .to('[data-anatomy-counter]', { opacity: 1, duration: 0.05 }, 0.26)
    .to('[data-anatomy-intro]', { autoAlpha: 0, y: -40, duration: 0.06 }, 0.27)
    .to('[data-anatomy-counter]', { opacity: 0, duration: 0.04 }, 0.86)
    .fromTo('[data-anatomy-outro]', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.06, ease: 'power3.out' }, 0.9)
    .call(() => {
      if (tl.scrollTrigger.direction > 0) {
        gsap.fromTo('[data-flash]', { opacity: 0.5 }, { opacity: 0, duration: 1.4, ease: 'power2.out' });
        ambient.swell();
      }
    }, null, 0.97)
    .set({}, {}, 1);
}

/* ------------------------------------------------------------------ STORY */

function setupStory({ triggers: T }) {
  const pin = $('[data-story-pin]');
  const odoEl = $('[data-odometer]');
  const slot = $('[data-story-year]');
  const odo = new Odometer(odoEl);
  const year = { v: 2026 };
  odo.set(year.v);
  const words = $$('[data-story-word]');
  const text = SplitText.create('[data-story-text]', { type: 'lines', mask: 'lines' }).lines;

  // where the big counter must land so it becomes the "1989" in the title
  const M = { dx: 0, dy: 0, scale: 0.3 };
  const offsetIn = (el) => {
    let x = 0, y = 0, n = el;
    while (n && n !== pin) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const measure = () => {
    const o = offsetIn(odoEl), s = offsetIn(slot);
    M.dx = s.x + s.w / 2 - (o.x + o.w / 2);
    M.dy = s.y + s.h / 2 - (o.y + o.h / 2);
    M.scale = parseFloat(getComputedStyle(slot).fontSize) / parseFloat(getComputedStyle(odoEl).fontSize);
  };
  measure();
  ScrollTrigger.addEventListener('refreshInit', measure);

  T.storyEnter = ScrollTrigger.create({ trigger: '#story', start: 'top bottom', end: 'top top' });
  gsap.fromTo('[data-film]', { opacity: 0 }, {
    opacity: 0.85, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '#story', start: 'top 70%', end: 'top top', scrub: true },
  });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '#story', start: 'top top', end: '+=340%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
  });
  T.story = tl.scrollTrigger;

  tl.fromTo('[data-rewind-label]', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.04 }, 0)
    .fromTo('[data-rewind-sub]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 }, 0.02)
    .to(year, { v: 1989, duration: 0.28, ease: 'power2.inOut', onUpdate: () => odo.set(year.v) }, 0.02)
    .to(['[data-rewind-label]', '[data-rewind-sub]'], { autoAlpha: 0, duration: 0.04 }, 0.31)
    .to(odoEl, { x: () => M.dx, y: () => M.dy, scale: () => M.scale, duration: 0.1, ease: 'power2.inOut' }, 0.32)
    .from('#story .eyebrow', { autoAlpha: 0, x: -20, duration: 0.05 }, 0.33)
    .from(words, { yPercent: 110, autoAlpha: 0, stagger: 0.02, duration: 0.06, ease: 'power3.out' }, 0.34)
    .fromTo(slot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0.415)
    .to(odoEl, { autoAlpha: 0, duration: 0.02 }, 0.425)
    .from('[data-story-rule]', { scaleX: 0, duration: 0.04 }, 0.42)
    .from(text, { yPercent: 100, stagger: 0.01, duration: 0.05, ease: 'power3.out' }, 0.44)
    .from('[data-story-btn]', { autoAlpha: 0, y: 20, duration: 0.04 }, 0.5)
    .fromTo('[data-story-photo]', { autoAlpha: 0, y: 260, rotation: -18 }, { autoAlpha: 1, y: 0, rotation: -5, duration: 0.12, ease: 'power3.out' }, 0.46)
    .fromTo('[data-story-photo-inner]', { filter: 'brightness(2.6) sepia(1) blur(6px)' }, { filter: 'brightness(1) sepia(0.15) blur(0px)', duration: 0.14 }, 0.5)
    // on phones the photograph steps aside so the quote can take its place
    .to('[data-story-photo]', { autoAlpha: () => (isMobile() ? 0 : 1), y: () => (isMobile() ? -40 : 0), duration: 0.05 }, 0.62);

  $$('[data-quote-line]').forEach((line, i) => {
    tl.to(line, { clipPath: 'inset(-20% -12% -30% 0%)', duration: 0.05, ease: 'power1.inOut' }, 0.64 + i * 0.045);
  });
  tl.to('[data-signature]', { clipPath: 'inset(-20% -25% -40% 0%)', duration: 0.06 }, 0.83)
    .to('.story__quote-role', { opacity: 1, duration: 0.03 }, 0.86)
    .to('[data-bd-present]', { opacity: 1, duration: 0.1 }, 0.86)
    .to('[data-film]', { opacity: 0, duration: 0.08 }, 0.88)
    .set({}, {}, 1);
}

/* ---------------------------------------------------------------- FOUNDER */

function setupFounder() {
  const photo = $('[data-founder-photo]');
  const onPhoto = () => {
    if (photo.naturalWidth > 0) document.documentElement.classList.add('has-founder-photo');
    else photo.classList.add('is-missing');
  };
  photo.addEventListener('load', onPhoto);
  photo.addEventListener('error', () => photo.classList.add('is-missing'));
  if (photo.complete) onPhoto();

  const name = SplitText.create('[data-founder-name]', { type: 'words,chars' }).chars;
  const text = SplitText.create('[data-founder-text]', { type: 'lines', mask: 'lines' }).lines;
  const words = SplitText.create('[data-quote-words]', { type: 'words' }).words;

  gsap.timeline({ scrollTrigger: { trigger: '.founder__grid', start: 'top 70%', toggleActions: 'play none none reverse' } })
    .fromTo('[data-founder-arch-inner]', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' }, 0)
    .from('[data-founder-arch]', { autoAlpha: 0, duration: 1.2 }, 0)
    .from('#founder .eyebrow', { autoAlpha: 0, x: -20, duration: 1 }, 0.4)
    .from(name, { yPercent: 110, stagger: 0.06, duration: 1.4, ease: 'expo.out' }, 0.5)
    .from('[data-founder-rule]', { scaleX: 0, duration: 1.2, ease: 'expo.out' }, 0.9)
    .from(text, { yPercent: 100, stagger: 0.08, duration: 1.2, ease: 'expo.out' }, 0.9)
    .from('[data-founder-btn]', { autoAlpha: 0, y: 20, duration: 1 }, 1.2)
    .from('[data-burner]', { autoAlpha: 0, y: 60, duration: 1.6, ease: 'expo.out' }, 0.6);

  gsap.fromTo('[data-founder-arch]', { y: 70 }, { y: -70, ease: 'none', scrollTrigger: { trigger: '#founder', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('[data-burner]', { yPercent: 12 }, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '#founder', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo(words, { opacity: 0.1 }, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '[data-founder-quote]', start: 'top 85%', end: 'bottom 50%', scrub: true },
  });
  gsap.from('[data-founder-quote] cite', { autoAlpha: 0, y: 20, duration: 1.2, scrollTrigger: { trigger: '[data-founder-quote]', start: 'top 60%' } });

  const smoke = $('[data-smoke]');
  if (smoke && !isMobile()) new Smoke(smoke);
}

/* ------------------------------------------------------------- COLLECTION */

function setupCollection({ triggers: T, lenis, ambient }) {
  const title = SplitText.create('#collection .display__line', { type: 'words,chars' }).chars;
  const articles = $$('[data-variant]');
  const names = articles.map((a) => SplitText.create(a.querySelector('[data-variant-name]'), { type: 'words,chars' }).chars);
  const cards = $$('[data-rail-go]');
  const grades = $$('[data-grade]');
  const giants = $$('[data-giant-word]');
  let current = 0;

  function show(i) {
    if (i === current) return;
    const prev = current;
    current = i;
    gsap.to(articles[prev], {
      autoAlpha: 0, y: -24, duration: 0.5, ease: 'power2.in', overwrite: true,
      onComplete: () => current !== prev && articles[prev].classList.remove('is-active'),
    });
    articles[i].classList.add('is-active');
    gsap.fromTo(articles[i], { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, delay: 0.25, ease: 'expo.out', overwrite: true });
    gsap.fromTo(names[i], { yPercent: 110 }, { yPercent: 0, stagger: 0.05, duration: 1.1, delay: 0.3, ease: 'expo.out', overwrite: true });
    cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
    grades.forEach((g, k) => gsap.to(g, { opacity: k === i ? 1 : 0, duration: 1.2, overwrite: true }));
    giants.forEach((g, k) => gsap.to(g, { opacity: k === i ? 1 : 0, duration: 1, overwrite: 'auto' }));
    ambient.swell();
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#collection', start: 'top top', end: '+=340%', pin: true, scrub: 1, anticipatePin: 1,
      onUpdate: (self) => show(self.progress < 0.375 ? 0 : self.progress < 0.7 ? 1 : 2),
    },
  });
  T.collection = tl.scrollTrigger;
  T.colEnter = ScrollTrigger.create({ trigger: '#collection', start: 'top bottom', end: 'top top' });

  tl.fromTo('[data-collection-progress]', { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
  giants.forEach((g) => tl.fromTo(g, { xPercent: 14 }, { xPercent: -14, duration: 1 }, 0));

  gsap.timeline({ scrollTrigger: { trigger: '#collection', start: 'top 45%', toggleActions: 'play none none reverse' } })
    .from('#collection .eyebrow', { autoAlpha: 0, x: -20, duration: 1 }, 0)
    .from(title, { yPercent: 120, stagger: 0.025, duration: 1.3, ease: 'expo.out' }, 0.1)
    .from('[data-variants]', { autoAlpha: 0, x: 40, duration: 1.4, ease: 'expo.out' }, 0.3)
    .from(cards, { autoAlpha: 0, x: -30, stagger: 0.1, duration: 1.2, ease: 'expo.out' }, 0.4);

  const stops = [0.18, 0.53, 0.86];
  cards.forEach((c, i) => c.addEventListener('click', () => {
    const st = T.collection;
    lenis.scrollTo(st.start + stops[i] * (st.end - st.start), { duration: 1.8 });
  }));

  let bag = 0;
  const badge = $('[data-bag-count]');
  const add = $('[data-add-to-bag]');
  const addLabel = add.querySelector('.btn__label');
  add.addEventListener('click', () => {
    bag += 1;
    badge.textContent = bag;
    badge.classList.add('has-items');
    gsap.fromTo(badge, { scale: 1.9 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    const name = articles[current].querySelector('[data-variant-name]').textContent.trim();
    addLabel.textContent = `${name} added ✓`;
    clearTimeout(add._t);
    add._t = setTimeout(() => (addLabel.textContent = 'Add to bag'), 1800);
  });
}

/* ---------------------------------------------------------------- PROMISE */

function setupPromise({ triggers: T }) {
  T.promise = ScrollTrigger.create({ trigger: '#promise', start: 'top bottom', end: 'bottom top' });
  const st = { trigger: '#promise', start: 'top 78%' };
  gsap.from('[data-promise]', { autoAlpha: 0, y: 40, stagger: 0.12, duration: 1.2, ease: 'expo.out', scrollTrigger: st });
  gsap.from('[data-promise] svg > *', { drawSVG: '0%', duration: 1.8, stagger: 0.04, ease: 'power2.inOut', scrollTrigger: { ...st } });
}

/* ---------------------------------------------------------------- JOURNEY */

function setupJourney() {
  const giant = $('[data-giant-footer]');
  const letters = $$('span', giant);
  gsap.from(letters, {
    yPercent: 100, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: giant, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
  });
  window.addEventListener('pointermove', (e) => {
    if (giant.getBoundingClientRect().top > innerHeight) return;
    letters.forEach((l) => {
      const r = l.getBoundingClientRect();
      l.style.setProperty('--mx', `${e.clientX - r.left}px`);
      l.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }, { passive: true });
  gsap.from('.journey__top > *', { autoAlpha: 0, y: 40, stagger: 0.12, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#journey', start: 'top 75%' } });

  const form = $('[data-subscribe]');
  const status = $('[data-subscribe-status]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    if (!input.checkValidity() || !input.value) {
      status.textContent = 'Please enter a valid email address.';
      gsap.fromTo(form.querySelector('.subscribe__row'), { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    status.textContent = 'Welcome to the journey. Your first story is on its way.';
    input.value = '';
  });
}

/* -------------------------------------------------------------- BACKDROPS */

function setupBackdropFades() {
  const fade = (inSel, outSel, trigger, start, end) => {
    gsap.fromTo(inSel, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger, start, end, scrub: true } });
    gsap.fromTo(outSel, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', immediateRender: false, scrollTrigger: { trigger, start, end, scrub: true } });
  };
  fade('[data-bd="anatomy"]', '[data-bd="hero"]', '#anatomy', 'top bottom', 'top top');
  fade('[data-bd="story"]', '[data-bd="anatomy"]', '#story', 'top bottom', 'top 15%');
  fade('[data-bd="founder"]', '[data-bd="story"]', '#founder', 'top bottom', 'top 20%');
  fade('[data-bd="collection"]', '[data-bd="founder"]', '#collection', 'top bottom', 'top top');
  fade('[data-bd="journey"]', '[data-bd="collection"]', '#promise', 'top bottom', 'bottom 40%');

  gsap.fromTo('[data-rosette]', { rotation: -30, scale: 0.85 }, {
    rotation: 60, scale: 1.1, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '#anatomy', start: 'top bottom', end: () => `+=${innerHeight * 5.8}`, scrub: true },
  });
  gsap.fromTo('[data-skyline="near"]', { xPercent: 0 }, {
    xPercent: -4, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: '#story', start: 'top top', end: () => `+=${innerHeight * 4.4}`, scrub: true },
  });
}

/* ----------------------------------------------------------------- CHROME */

function setupChrome({ lenis, ambient }) {
  const nav = $('[data-nav]');
  const fill = $('[data-chapters-fill]');
  const menu = $('[data-menu]');
  const burger = $('[data-burger]');
  let menuOpen = false;

  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-scrolled', y > 40);
      nav.classList.toggle('is-hidden', self.direction === 1 && y > innerHeight * 0.6 && !menuOpen);
      fill.style.transform = `scaleY(${self.progress})`;
    },
  });

  const chapterOf = { hero: 'hero', anatomy: 'anatomy', story: 'story', founder: 'founder', collection: 'collection', promise: 'collection', journey: 'journey' };
  const setActive = (id) => {
    $$('[data-chapter]').forEach((a) => a.classList.toggle('is-active', a.dataset.chapter === id));
    $$('[data-nav-link]').forEach((a) => a.classList.toggle('is-active', a.dataset.navLink === id));
  };
  $$('[data-section]').forEach((sec) => {
    // pinned chapters live inside a pin-spacer that carries their full scroll length
    const trigger = sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
    ScrollTrigger.create({
      trigger, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => self.isActive && setActive(chapterOf[sec.dataset.section]),
    });
  });

  const toggleMenu = (open) => {
    menuOpen = open;
    document.documentElement.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    menu.setAttribute('aria-hidden', !open);
    if (open) {
      lenis.stop();
      gsap.set(menu, { visibility: 'visible' });
      gsap.to(menu, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.inOut' });
      gsap.fromTo(menu.querySelectorAll('.menu__links a'), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 1, delay: 0.35, ease: 'expo.out' });
    } else {
      lenis.start();
      gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
    }
  };
  burger.addEventListener('click', () => toggleMenu(!menuOpen));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scrollto]');
    if (!a) return;
    const id = a.getAttribute('href');
    let target = id && id.length > 1 ? $(id) : null;
    if (!target) return;
    // a pinned chapter sits at the end of its pin-spacer once passed — aim for the start
    if (target.parentElement.classList.contains('pin-spacer')) target = target.parentElement;
    e.preventDefault();
    if (menuOpen) toggleMenu(false);
    lenis.scrollTo(target, { duration: 2.2, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
  });

  const soundBtn = $('[data-sound]');
  const soundLabel = $('[data-sound-label]');
  const setSound = (on) => {
    const ok = on ? ambient.start() : (ambient.stop(), true);
    const isOn = on && ok;
    soundBtn.classList.toggle('is-on', isOn);
    soundBtn.setAttribute('aria-pressed', isOn);
    soundLabel.textContent = isOn ? 'Sound on' : 'Sound off';
  };
  soundBtn.addEventListener('click', () => setSound(!ambient.on));
  return { setSound };
}
