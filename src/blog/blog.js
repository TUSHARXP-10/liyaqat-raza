import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initCursor } from '../ui/cursor.js';
import { prefersReducedMotion } from '../lib/math.js';
import { BY_ID } from '../shop/products.js';
import { REELS, CATEGORIES } from './reels.js';
import MEDIA from './media.json' with { type: 'json' };

// Blogs Raza (/blogs): a tilted wall of films behind the title, the featured
// rail, the filterable library, the photo wall, and a full-screen player that
// moves between films like reels (swipe, wheel, ↑ ↓).

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const base = import.meta.env.BASE_URL;
const media = (f) => `${base}media/blog/${f}`;
const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
const reduced = prefersReducedMotion();
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const WHATSAPP = '918976035333';

// films that have their web copies (npm run import:blog), featured first
const FILMS = REELS.filter((r) => MEDIA.reels[r.slug]).map((r) => ({
  ...r,
  ...MEDIA.reels[r.slug],
  product: BY_ID[r.product] ? r.product : null,
}));
const PHOTOS = MEDIA.photos;

/* ---------------------------------------------------------------- scroll */

const lenis = new Lenis({ lerp: reduced ? 1 : 0.09, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const target = $(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  toggleMenu(false);
  lenis.scrollTo(target, { duration: 1.6 });
});

/* ------------------------------------------------------------ nav + menu */

const nav = $('[data-nav]');
const menu = $('[data-menu]');
const burger = $('[data-burger]');
let menuOpen = false;
lenis.on('scroll', ({ scroll, direction }) => {
  nav.classList.toggle('is-scrolled', scroll > 40);
  nav.classList.toggle('is-hidden', direction === 1 && scroll > innerHeight * 0.6 && !menuOpen);
});
function toggleMenu(open) {
  if (open === menuOpen) return;
  menuOpen = open;
  document.documentElement.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-hidden', !open);
  if (open) {
    lenis.stop();
    gsap.set(menu, { visibility: 'visible' });
    gsap.to(menu, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.inOut' });
    gsap.fromTo($$('.menu__links a', menu), { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 1, delay: 0.35, ease: 'expo.out' });
  } else {
    lenis.start();
    gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
  }
}
burger.addEventListener('click', () => toggleMenu(!menuOpen));

/* ------------------------------------------------------------ previews */

// A card's silent loop starts on hover (desktop) or when it is the card
// nearest the middle of the screen (phones); only one runs at a time there.
function preview(card, on) {
  const v = $('video', card);
  if (!v) return;
  if (on) {
    if (!v.src) v.src = v.dataset.src;
    v.play().then(() => card.classList.add('is-previewing')).catch(() => {});
  } else {
    card.classList.remove('is-previewing');
    v.pause();
  }
}
// desktop: hover (listeners on the container, so re-rendered cards work too)
function hoverPreviews(root) {
  root.addEventListener('pointerover', (e) => {
    const c = e.target.closest('[data-card]');
    if (c && !c.contains(e.relatedTarget)) preview(c, true);
  });
  root.addEventListener('pointerout', (e) => {
    const c = e.target.closest('[data-card]');
    if (c && !c.contains(e.relatedTarget)) preview(c, false);
  });
}
// phones: per container, the fully visible card nearest the middle plays
const pickers = new Set();
lenis.on('scroll', () => requestAnimationFrame(() => pickers.forEach((p) => p())));
function centerPreviews(root) {
  const visible = new Set();
  let active = null;
  const pick = () => {
    let best = null;
    let bestD = Infinity;
    visible.forEach((c) => {
      if (!c.isConnected) return visible.delete(c);
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - innerHeight / 2) + Math.abs(r.left + r.width / 2 - innerWidth / 2) * 0.5;
      if (d < bestD) { bestD = d; best = c; }
    });
    if (best === active) return;
    if (active) preview(active, false);
    active = best;
    if (active) preview(active, true);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.intersectionRatio > 0.6 ? visible.add(e.target) : visible.delete(e.target)));
    pick();
  }, { threshold: [0, 0.6, 1] });
  $$('[data-card]', root).forEach((c) => io.observe(c));
  root.addEventListener('scroll', pick, { passive: true }); // the rail scrolls sideways
  pickers.add(pick);
  return () => {
    io.disconnect();
    pickers.delete(pick);
    if (active) preview(active, false);
  };
}
const watchPreviews = (root) => (isTouch() ? centerPreviews(root) : (hoverPreviews(root), null));

const cardMedia = (f, { eager = false } = {}) => `
  <img class="reel__poster" src="${media(f.poster)}" alt="" width="540" height="${Math.round(540 / f.ratio)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" />
  <video class="reel__video" muted loop playsinline preload="none" data-src="${media(f.preview)}" aria-hidden="true"></video>`;

/* ------------------------------------------------------------------ hero */

function buildHero() {
  // a deterministic shuffle so the wall mixes categories
  const order = FILMS.map((f, i) => ({ f, k: (i * 7919) % 37 })).sort((a, b) => a.k - b.k).map((x) => x.f);
  const cols = innerWidth < 820 ? 3 : 6;
  const wall = $('[data-wall]');
  const live = new Set(isTouch() ? [] : FILMS.filter((f) => f.featured).slice(0, 4).map((f) => f.slug));
  let html = '';
  for (let c = 0; c < cols; c++) {
    const films = order.filter((_, i) => i % cols === c);
    const tiles = [...films, ...films].map((f, i) => (i < films.length && live.has(f.slug)
      ? `<div class="bhero__tile is-live"><video src="${media(f.preview)}" poster="${media(f.poster)}" muted loop playsinline autoplay preload="auto"></video></div>`
      : `<div class="bhero__tile"><img src="${media(f.poster)}" alt="" loading="${c < 3 ? 'eager' : 'lazy'}" decoding="async" /></div>`)).join('');
    html += `<div class="bhero__col" style="--dur:${46 + c * 7}s;--dir:${c % 2 ? 'reverse' : 'normal'}"><div class="bhero__strip">${tiles}</div></div>`;
  }
  wall.innerHTML = html;

  const mins = Math.round(FILMS.reduce((s, f) => s + f.duration, 0) / 60);
  $('[data-stats]').innerHTML = [
    [FILMS.length, 'films'],
    [mins, 'minutes'],
    [PHOTOS.length, 'moments'],
  ].map(([n, l]) => `<li><strong data-count-to="${n}">${n}</strong><span>${l}</span></li>`).join('');

  if (reduced) return;
  const title = new SplitText('[data-title] .bhero__line', { type: 'chars', charsClass: 'bhero__char' });
  gsap.timeline({ delay: 0.15 })
    .from(wall, { autoAlpha: 0, scale: 1.25, duration: 2.2, ease: 'expo.out' })
    .from(title.chars, { yPercent: 115, rotateX: -80, autoAlpha: 0, stagger: 0.05, duration: 1.4, ease: 'expo.out' }, 0.2)
    .from(['[data-lede]', '.bhero__cta', '[data-stats]', '.bhero .eyebrow'], { y: 24, autoAlpha: 0, stagger: 0.1, duration: 1.2, ease: 'expo.out' }, 0.7)
    .from('[data-count-to]', { textContent: 0, snap: { textContent: 1 }, duration: 1.6, ease: 'power2.out', stagger: 0.1 }, 0.9);

  // the wall leans toward the pointer, and falls away as you scroll
  if (!isTouch()) {
    const rx = gsap.quickTo(wall, '--rx', { duration: 1.2, ease: 'power3.out' });
    const ry = gsap.quickTo(wall, '--ry', { duration: 1.2, ease: 'power3.out' });
    window.addEventListener('pointermove', (e) => {
      rx(((e.clientY / innerHeight) - 0.5) * -6);
      ry(((e.clientX / innerWidth) - 0.5) * 8);
    }, { passive: true });
  }
  gsap.to(wall, { yPercent: 14, scale: 1.08, autoAlpha: 0.35, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.bhero__copy', { yPercent: -18, autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: '30% top', end: 'bottom top', scrub: true } });
}

/* ---------------------------------------------------------------- featured */

function buildRail() {
  const rail = $('[data-rail]');
  const films = FILMS.filter((f) => f.featured);
  rail.innerHTML = films.map((f, i) => `
    <article class="feat" data-card>
      <button class="feat__media" type="button" data-open="${esc(f.slug)}" data-cursor-label="Play" aria-label="Play ${esc(f.title)} (${clock(f.duration)})">
        ${cardMedia(f, { eager: i < 3 })}
        <span class="feat__no">${String(i + 1).padStart(2, '0')}</span>
        <span class="feat__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
      </button>
      <div class="feat__body">
        <p class="reel__cat">${esc(CAT[f.cat])} · ${clock(f.duration)}</p>
        <h3 class="feat__title">${esc(f.title)}</h3>
        <p class="feat__text">${esc(f.text)}</p>
      </div>
    </article>`).join('');
  watchPreviews(rail);

  const step = () => ($('.feat', rail)?.offsetWidth || 300) + 24;
  $('[data-rail-prev]').addEventListener('click', () => rail.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
  $('[data-rail-next]').addEventListener('click', () => rail.scrollBy({ left: step() * 2, behavior: 'smooth' }));

  // drag to scroll with a mouse
  let drag = null;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) {
      drag.moved = true;
      rail.classList.add('is-dragging');
    }
    rail.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) rail.addEventListener('click', (e) => e.stopPropagation(), { capture: true, once: true });
    drag = null;
    rail.classList.remove('is-dragging');
  });

  // cards tilt toward the pointer
  if (!isTouch() && !reduced) {
    $$('.feat', rail).forEach((card) => {
      const m = $('.feat__media', card);
      card.addEventListener('pointermove', (e) => {
        const r = m.getBoundingClientRect();
        gsap.to(m, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 10, rotateX: ((e.clientY - r.top) / r.height - 0.5) * -10, duration: 0.6, ease: 'power3.out' });
      });
      card.addEventListener('pointerleave', () => gsap.to(m, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'expo.out' }));
    });
  }
  if (!reduced) gsap.from($$('.feat', rail), { x: 120, autoAlpha: 0, stagger: 0.08, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: rail, start: 'top 85%' } });
}

/* ----------------------------------------------------------------- library */

let current = 'all';
const listFor = (cat) => (cat === 'all' ? FILMS : FILMS.filter((f) => f.cat === cat));
let stopGridPreviews = null;

function buildLibrary() {
  const chips = $('[data-chips]');
  const grid = $('[data-grid]');
  const renderChips = () => {
    chips.innerHTML = [{ key: 'all', label: 'All films' }, ...CATEGORIES].map((c) => {
      const on = c.key === current;
      return `<button type="button" role="tab" class="chip${on ? ' is-on' : ''}" aria-selected="${on}" data-cat="${c.key}">${esc(c.label)}<small>${listFor(c.key).length}</small></button>`;
    }).join('');
  };
  const renderGrid = () => {
    stopGridPreviews?.();
    grid.innerHTML = listFor(current).map((f) => `
      <article class="reel" data-card>
        <button class="reel__media" type="button" data-open="${esc(f.slug)}" data-cursor-label="Play" aria-label="Play ${esc(f.title)} (${clock(f.duration)})">
          ${cardMedia(f)}
          <span class="reel__dur">${clock(f.duration)}</span>
          <span class="reel__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        </button>
        <div class="reel__body">
          <p class="reel__cat"><span class="reel__dot reel__dot--${f.cat}" aria-hidden="true"></span>${esc(CAT[f.cat])}</p>
          <h3 class="reel__title">${esc(f.title)}</h3>
          ${f.product ? `<a class="reel__shop" href="/?p=${encodeURIComponent(f.product)}" aria-label="Shop ${esc(BY_ID[f.product].name)}">Shop<span class="reel__shop-name"> ${esc(BY_ID[f.product].name)}</span> →</a>` : ''}
        </div>
      </article>`).join('');
    if (isTouch()) stopGridPreviews = centerPreviews(grid);
    if (!reduced) gsap.from($$('.reel', grid), { y: 40, autoAlpha: 0, stagger: 0.03, duration: 0.9, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    ScrollTrigger.refresh();
  };
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === current) return;
    current = b.dataset.cat;
    renderChips();
    renderGrid();
  });
  renderChips();
  renderGrid();
  if (!isTouch()) hoverPreviews(grid);
}

/* ------------------------------------------------------------------ photos */

function buildMoments() {
  const wall = $('[data-moments]');
  wall.innerHTML = PHOTOS.map((p, i) => `
    <button type="button" class="moment" data-photo="${i}" data-cursor-label="View" aria-label="Photo ${i + 1} of ${PHOTOS.length}" style="aspect-ratio:${p.ratio}">
      <img src="${media(p.sm)}" alt="" loading="lazy" decoding="async" />
    </button>`).join('');
  if (!reduced) gsap.from($$('.moment', wall), { y: 60, autoAlpha: 0, stagger: 0.05, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: wall, start: 'top 85%' } });

  // lightbox
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo');
  box.innerHTML = '<img alt="" /><button type="button" class="lightbox__close" aria-label="Close">×</button><button type="button" class="lightbox__prev" aria-label="Previous photo">←</button><button type="button" class="lightbox__next" aria-label="Next photo">→</button>';
  document.body.append(box);
  let at = 0;
  let back = null;
  const show = (i) => {
    at = (i + PHOTOS.length) % PHOTOS.length;
    $('img', box).src = media(PHOTOS[at].src);
  };
  const close = () => {
    box.classList.remove('is-open');
    lenis.start();
    back?.focus();
  };
  wall.addEventListener('click', (e) => {
    const b = e.target.closest('[data-photo]');
    if (!b) return;
    back = b;
    show(Number(b.dataset.photo));
    box.classList.add('is-open');
    lenis.stop();
    $('.lightbox__close', box).focus();
  });
  box.addEventListener('click', (e) => {
    if (e.target.closest('.lightbox__prev')) show(at - 1);
    else if (e.target.closest('.lightbox__next')) show(at + 1);
    else if (e.target === box || e.target.closest('.lightbox__close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'ArrowRight') show(at + 1);
  });
}

/* ------------------------------------------------------------------ player */

function buildViewer() {
  const root = $('[data-viewer]');
  const track = $('[data-track]', root);
  const countEl = $('[data-count]', root);
  const hint = $('[data-hint]', root);
  const soundBtn = $('[data-sound]', root);
  // one <video> travels between slides, so a phone that allowed sound once keeps it
  const video = document.createElement('video');
  video.className = 'vslide__video';
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  let list = [];
  let at = -1;
  let sound = true;
  let back = null;
  let io = null;

  const setSound = (on) => {
    sound = on;
    video.muted = !on;
    soundBtn.setAttribute('aria-pressed', on);
    soundBtn.setAttribute('aria-label', on ? 'Mute' : 'Sound on');
    root.classList.toggle('is-muted', !on);
    if (on) hint.classList.remove('is-on');
  };

  const shareUrl = (f) => `${location.origin}${location.pathname}?v=${encodeURIComponent(f.slug)}`;
  const askUrl = (f) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hello Raza Perfume! I just watched “${f.title}” on your website${f.product ? ` and I'd like to know more about ${BY_ID[f.product].name}` : ''}.`)}`;

  const slide = (f, i) => `
    <section class="vslide" data-i="${i}" aria-label="${esc(f.title)}">
      <img class="vslide__bg" src="${media(f.poster)}" alt="" aria-hidden="true" loading="lazy" />
      <div class="vslide__frame" data-frame>
        <img class="vslide__poster" src="${media(f.poster)}" alt="" loading="${Math.abs(i - at) < 2 ? 'eager' : 'lazy'}" />
        <span class="vslide__state" aria-hidden="true"></span>
        <span class="vslide__bar"><i data-bar></i></span>
      </div>
      <div class="vslide__info">
        <p class="reel__cat"><span class="reel__dot reel__dot--${f.cat}" aria-hidden="true"></span>${esc(CAT[f.cat])} · ${clock(f.duration)}</p>
        <h2 class="vslide__title">${esc(f.title)}</h2>
        <p class="vslide__text">${esc(f.text)}</p>
        <div class="vslide__actions">
          ${f.product ? `<a class="btn btn--solid" href="/?p=${encodeURIComponent(f.product)}"><span class="btn__label">Shop ${esc(BY_ID[f.product].name)}</span><span class="btn__arrow" aria-hidden="true">→</span></a>` : ''}
          <a class="vslide__link" href="${esc(askUrl(f))}" target="_blank" rel="noopener">Ask on WhatsApp</a>
          <button class="vslide__link" type="button" data-share="${i}">Share</button>
        </div>
      </div>
    </section>`;

  function goto(i, smooth = true) {
    const el = $$('.vslide', track)[i];
    if (el) track.scrollTo({ top: el.offsetTop, behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }

  function activate(i) {
    if (i === at || !list[i]) return;
    at = i;
    const f = list[i];
    const s = $$('.vslide', track)[i];
    $$('.vslide', track).forEach((x) => x.classList.toggle('is-current', x === s));
    $('[data-frame]', s).prepend(video);
    video.poster = media(f.poster);
    video.src = media(f.video);
    video.currentTime = 0;
    video.muted = !sound;
    video.play().catch(() => {
      // sound needs a tap on this device: play silently and say so
      video.muted = true;
      root.classList.add('is-muted');
      hint.classList.add('is-on');
      video.play().catch(() => s.classList.add('is-paused'));
    });
    s.classList.remove('is-paused');
    countEl.textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    const u = new URL(location.href);
    u.searchParams.set('v', f.slug);
    history.replaceState(null, '', u);
    // warm the next poster
    if (list[i + 1]) new Image().src = media(list[i + 1].poster);
  }

  function open(slug, films = FILMS, { withSound = true } = {}) {
    list = films;
    at = -1;
    back = document.activeElement;
    track.innerHTML = list.map(slide).join('');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('viewer-open');
    lenis.stop();
    setSound(withSound);
    const start = Math.max(0, list.findIndex((f) => f.slug === slug));
    goto(start, false);
    activate(start);
    io?.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) activate(Number(e.target.dataset.i)); });
    }, { root: track, threshold: 0.6 });
    $$('.vslide', track).forEach((s) => io.observe(s));
    setTimeout(() => $('[data-close]', root).focus({ preventScroll: true }), 50);
  }

  function close() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    io?.disconnect();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('viewer-open');
    hint.classList.remove('is-on');
    lenis.start();
    const u = new URL(location.href);
    u.searchParams.delete('v');
    history.replaceState(null, '', u);
    back?.focus?.({ preventScroll: true });
  }

  // a tap on the film: turns sound on after a silent start, else play / pause
  const toggle = () => {
    const s = $$('.vslide', track)[at];
    if (hint.classList.contains('is-on')) {
      setSound(true);
      video.play().catch(() => {});
      s.classList.remove('is-paused');
      return;
    }
    if (video.paused) {
      video.play();
      s.classList.remove('is-paused');
    } else {
      video.pause();
      s.classList.add('is-paused');
    }
  };

  video.addEventListener('timeupdate', () => {
    const bar = $$('[data-bar]', track)[at];
    if (bar && video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
  });
  // like reels: the next film starts when one ends (the last one loops)
  video.addEventListener('ended', () => {
    if (at < list.length - 1) goto(at + 1);
    else video.play().catch(() => {});
  });

  track.addEventListener('click', (e) => {
    if (e.target.closest('[data-frame]')) return toggle();
    const share = e.target.closest('[data-share]');
    if (share) {
      const f = list[Number(share.dataset.share)];
      const url = shareUrl(f);
      if (navigator.share) navigator.share({ title: `${f.title} · Blogs Raza`, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => { share.textContent = 'Link copied'; setTimeout(() => (share.textContent = 'Share'), 1800); });
    }
  });
  $('[data-close]', root).addEventListener('click', close);
  $('[data-prev]', root).addEventListener('click', () => goto(at - 1));
  $('[data-next]', root).addEventListener('click', () => goto(at + 1));
  soundBtn.addEventListener('click', () => setSound(!sound));
  hint.addEventListener('click', () => setSound(true));
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); goto(at + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); goto(at - 1); }
    else if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); toggle(); }
    else if (e.key === 'm') setSound(!sound);
  });

  // any card or button with data-open plays that film, within its list
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (!b || root.contains(b)) return;
    const inRail = b.closest('[data-rail]');
    open(b.dataset.open, inRail ? FILMS.filter((f) => f.featured).concat(FILMS.filter((f) => !f.featured)) : listFor(current));
  });
  $('[data-play-all]').addEventListener('click', () => open(FILMS[0].slug, FILMS));

  // shared link: /blogs?v=<film> opens it (silently until tapped: no gesture yet)
  const v = new URLSearchParams(location.search).get('v');
  if (v && FILMS.some((f) => f.slug === v)) {
    open(v, FILMS, { withSound: false });
    hint.classList.add('is-on');
  }
}

/* --------------------------------------------------------------- marquee */

function buildMarquee() {
  const el = $('[data-marquee]');
  if (!el) return;
  const words = ['The blind test', 'Fragrance films', 'In the lab', 'At the counter', 'Raza Perfume NX2', 'Since 1986'];
  const run = words.map((w) => `<span>${esc(w)}</span><i aria-hidden="true">✦</i>`).join('');
  el.innerHTML = run + run;
}

/* ------------------------------------------------------------------- go */

buildHero();
buildRail();
buildMarquee();
buildLibrary();
buildMoments();
buildViewer();
initCursor();
if (!reduced) {
  $$('.bsec__title .display__line, .bfoot__title .display__line').forEach((line) => {
    gsap.from(line, { yPercent: 110, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: line, start: 'top 90%' } });
  });
}
window.__blog = { lenis, FILMS };
