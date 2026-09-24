import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SHOP } from '../content.js';
import { CATEGORY_LABEL } from './products.js';
import { catalog } from './catalog.js';
import { cart, limitFor } from './cart.js';
import { wishlist } from './wishlist.js';
import { score, suggest, highlight } from './search.js';
import { tintFor, imageFor } from './look.js';
import { backendEnabled, fetchCatalog, submitOrder } from './backend.js';

// Chapter VI · The Atelier — catalogue, quick view, bag drawer, checkout.
//
// Browsing: collection tabs + originals / inspired / saved filters, forgiving
// search ("did you mean"), sort, grid or list layout; every filter is kept in
// the address bar so a filtered view can be shared or bookmarked.
// Buying: add / quantity steppers capped by stock, "Ask price" on WhatsApp
// for anything not priced yet, and checkout that saves the order to Supabase
// (when configured) and opens WhatsApp with the order written out.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'luxury', label: 'Luxury' },
  { key: 'premium', label: 'Premium' },
  { key: 'regular', label: 'Regular' },
];
const ORIGINS = [
  { key: 'originals', label: 'Raza originals' },
  { key: 'inspired', label: 'Inspired' },
];
const DEFAULTS = { cat: 'all', q: '', origin: 'all', saved: false, sort: 'featured' };
const AUTO_PAGES = 2; // load-on-scroll this many pages, then hand over to the button
const LOW_STOCK = 5;

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (n) => money.format(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
const pad = (n) => String(n).padStart(2, '0');
const collectionOf = (p) => (p.category === 'house' ? 'House signature' : `${CATEGORY_LABEL[p.category]} collection`);
const soldOut = (p) => p.stock === 0;
const lowStock = (p) => p.stock != null && p.stock > 0 && p.stock <= LOW_STOCK;
const priceText = (p) => (p.price != null ? fmt(p.price) : 'Price on request');
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const ICON_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.3-.5-2.4-1.6-2.9-2.9l1-1-1-2z"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

function whatsappUrl(text) {
  const base = SHOP.whatsapp ? `https://wa.me/${SHOP.whatsapp}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}
const askUrl = (p) => whatsappUrl(p.price == null || soldOut(p)
  ? `Hello Raza Perfume! Could you share the price${soldOut(p) ? ' and availability' : ''} of ${p.name} (${collectionOf(p)}, No. ${pad(p.number)})?`
  : `Hello Raza Perfume! I'd like to know more about ${p.name} (${collectionOf(p)}, No. ${pad(p.number)}).`);

/* ------------------------------------------------------------------ visuals */

export function bottleSVG(p, cls = 'product__bottle') {
  const cap =
    p.category === 'luxury'
      ? '<path class="b-cap" d="M13 2h14l3 5v8H10V7z"/><rect class="b-band" x="10" y="13" width="20" height="2"/>'
      : p.category === 'premium' || p.category === 'house'
        ? '<rect class="b-cap b-cap--dark" x="12" y="3" width="16" height="12" rx="1.5"/><rect class="b-band" x="12" y="13" width="16" height="2"/>'
        : '<rect class="b-cap" x="14" y="4" width="12" height="11" rx="3"/>';
  return `<svg viewBox="0 0 40 64" aria-hidden="true" class="${cls}" style="--tint:${tintFor(p)}">${cap}<rect class="b-neck" x="17" y="15" width="6" height="4"/><rect class="b-glass" x="5" y="19" width="30" height="42" rx="5"/><rect class="b-liquid" x="8" y="25" width="24" height="33" rx="3"/><rect class="b-label" x="12" y="31" width="16" height="19" rx="1"/><path class="b-shine" d="M10 23v33"/></svg>`;
}

// product photo; falls back to the drawn bottle if the image is missing
const photo = (p, cls, { eager = false, alt = '' } = {}) =>
  `<img class="${cls}" src="${imageFor(p)}" alt="${esc(alt)}" width="800" height="800" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-photo="${esc(p.id)}" />`;

function watchPhotos() {
  document.addEventListener('load', (e) => {
    if (e.target.matches?.('img[data-photo]')) e.target.classList.add('is-loaded');
  }, true);
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img.matches?.('img[data-photo]')) return;
    const p = catalog.get(img.dataset.photo);
    if (!p) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = bottleSVG(p, `${img.className.split(' ')[0]} is-fallback`);
    img.replaceWith(tpl.content.firstChild);
  }, true);
}
const markLoaded = (root) =>
  $$('img[data-photo]', root).forEach((img) => img.complete && img.naturalWidth && img.classList.add('is-loaded'));

const heartButton = (p, cls = 'heart') => {
  const on = wishlist.has(p.id);
  return `<button class="${cls}${on ? ' is-on' : ''}" type="button" data-save="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove' : 'Save'} ${esc(p.name)} ${on ? 'from' : 'to'} wishlist">${ICON_HEART}</button>`;
};

function stockBadge(p) {
  if (soldOut(p)) return '<span class="stock stock--out">Sold out</span>';
  if (lowStock(p)) return `<span class="stock stock--low">Only ${p.stock} left</span>`;
  return '';
}

function priceBlock(p) {
  if (p.price != null && !soldOut(p)) return `<span class="product__price">${fmt(p.price)}</span>`;
  return `<a class="product__ask" href="${esc(askUrl(p))}" target="_blank" rel="noopener" aria-label="Ask the price of ${esc(p.name)} on WhatsApp">${ICON_WA}<span>${soldOut(p) ? 'Ask availability' : 'Ask price'}</span></a>`;
}

function buyControl(p) {
  if (soldOut(p)) return '<button class="product__add" type="button" disabled>Sold out</button>';
  const q = cart.qtyOf(p.id);
  if (!q) return `<button class="product__add" type="button" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag"><span aria-hidden="true">+</span> Add</button>`;
  const atMax = q >= limitFor(p.id);
  return `<div class="stepper" role="group" aria-label="${esc(p.name)} in your bag">
    <button type="button" data-dec="${esc(p.id)}" aria-label="One less ${esc(p.name)}">−</button>
    <span>${q}</span>
    <button type="button" data-inc="${esc(p.id)}" aria-label="One more ${esc(p.name)}"${atMax ? ' disabled' : ''}>+</button>
  </div>`;
}

function productCard(p, query = '') {
  return `<article class="product${soldOut(p) ? ' is-out' : ''}" data-id="${esc(p.id)}">
  <button class="product__media" type="button" data-view="${esc(p.id)}" aria-label="Quick view: ${esc(p.name)}">
    ${photo(p, 'product__img')}
    <span class="product__no">No. ${pad(p.number)}</span>
    ${stockBadge(p)}
    <span class="product__quick" aria-hidden="true">Quick view</span>
  </button>
  ${heartButton(p, 'heart product__heart')}
  <div class="product__body">
    <h3 class="product__name"><button type="button" data-view="${esc(p.id)}">${highlight(p.name, query, esc)}</button></h3>
    <p class="product__meta"><span class="dot dot--${p.category}" aria-hidden="true"></span>${collectionOf(p)}${p.inspired ? '<span class="product__tag">Inspired</span>' : ''}</p>
    <div class="product__foot">
      <div class="product__pricebox">${priceBlock(p)}</div>
      <div class="product__buy" data-buy="${esc(p.id)}">${buyControl(p)}</div>
    </div>
  </div>
</article>`;
}

function describe(p) {
  if (p.description) return p.description;
  if (p.inspired) return `Raza’s own interpretation of a much-loved signature, from the ${collectionOf(p).toLowerCase()}.`;
  return `From the House of Raza’s ${collectionOf(p).toLowerCase()}.`;
}

/* -------------------------------------------------------------------- toast */

let toastTimer = null;
function toast(p, message, { cta = 'View bag' } = {}) {
  const el = $('[data-toast]');
  el.innerHTML = `${p ? photo(p, 'toast__img', { eager: true }) : ''}<span class="toast__text">${esc(message)}</span>${cta ? `<span class="toast__cta">${esc(cta)}</span>` : ''}`;
  markLoaded(el);
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

function added(p, qty = 1) {
  const got = cart.add(p.id, qty);
  if (!got) return toast(p, soldOut(p) ? `${p.name} is sold out` : `All ${limitFor(p.id)} in stock are in your bag`);
  toast(p, got > 1 ? `${got} × ${p.name} added` : `${p.name} added to your bag`);
  // bump the nav badge; clearProps hands scale back to CSS so an empty bag hides it
  gsap.fromTo('[data-bag-count], [data-bag-fab-count]', { scale: 1.9 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' });
}

function toggleSaved(id) {
  const p = catalog.get(id);
  const on = wishlist.toggle(id);
  if (on && p) toast(p, `${p.name} saved to your wishlist`, { cta: null });
  return on;
}

// keep keyboard focus on the same control when a stepper re-renders
function withFocus(fn) {
  const a = document.activeElement;
  const id = a?.dataset?.inc || a?.dataset?.dec || a?.dataset?.add;
  const kind = a?.dataset?.inc ? 'inc' : a?.dataset?.dec ? 'dec' : a?.dataset?.add ? 'add' : null;
  fn();
  if (!id) return;
  const scope = a.closest('[data-qv]') ? $('[data-qv]') : document;
  const next = $(`[data-${kind}="${CSS.escape(id)}"]:not([disabled])`, scope) || $(`[data-dec="${CSS.escape(id)}"]`, scope) || $(`[data-add="${CSS.escape(id)}"]`, scope);
  next?.focus();
}

/* --------------------------------------------------------------------- grid */

function initGrid({ lenis, quickView }) {
  const section = $('#shop');
  const grid = $('[data-shop-grid]');
  const tabsEl = $('[data-shop-tabs]');
  const chipsEl = $('[data-shop-chips]');
  const activeEl = $('[data-shop-active]');
  const search = $('[data-shop-search]');
  const clear = $('[data-shop-clear]');
  const sort = $('[data-shop-sort]');
  const viewEl = $('[data-shop-view]');
  const countEl = $('[data-shop-count]');
  const controls = $('[data-shop-controls]');
  const more = $('[data-shop-more]');
  const none = $('[data-shop-none]');

  // state: defaults ← remembered layout ← address bar
  const params = new URLSearchParams(location.search);
  const state = {
    ...DEFAULTS,
    view: store.get('raza-shop-view') === 'list' ? 'list' : 'grid',
    shown: 0,
    autoPages: 0,
  };
  if (TABS.some((t) => t.key === params.get('c'))) state.cat = params.get('c');
  if (ORIGINS.some((o) => o.key === params.get('o'))) state.origin = params.get('o');
  if (params.get('q')) state.q = params.get('q').slice(0, 60);
  if (params.get('saved') === '1') state.saved = true;
  if (['az', 'za', 'price-asc', 'price-desc'].includes(params.get('s'))) state.sort = params.get('s');
  if (['grid', 'list'].includes(params.get('v'))) state.view = params.get('v');
  search.value = state.q;
  const page = () => (state.view === 'list' ? 24 : 16);
  state.shown = page();

  let refreshTimer = null;
  const refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 220);
  };

  // one filter pass; `skip` leaves one filter out (for the counts on tabs/chips)
  const filtered = (skip = null) => catalog.list()
    .filter((p) => skip === 'cat' || state.cat === 'all' || p.category === state.cat)
    .filter((p) => skip === 'origin' || state.origin === 'all' || (state.origin === 'inspired' ? p.inspired : !p.inspired))
    .filter((p) => skip === 'saved' || !state.saved || wishlist.has(p.id))
    .map((p) => ({ p, s: state.q ? score(p, state.q) : 1 }))
    .filter((x) => x.s > 0);

  const anyPriced = () => catalog.list().some((p) => p.price != null);
  const byPrice = (dir) => (a, b) => (a.price == null) - (b.price == null) || (a.price - b.price) * dir || a.name.localeCompare(b.name);
  const results = () => {
    const rows = filtered();
    const sortKey = state.sort.startsWith('price') && !anyPriced() ? 'featured' : state.sort;
    if (sortKey === 'featured' && state.q) rows.sort((a, b) => b.s - a.s); // relevance first when searching
    const list = rows.map((x) => x.p);
    if (sortKey === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'za') list.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortKey === 'price-asc') list.sort(byPrice(1));
    else if (sortKey === 'price-desc') list.sort(byPrice(-1));
    // sold-out fragrances sink to the end, whatever the order (the sort is stable)
    list.sort((a, b) => soldOut(a) - soldOut(b));
    return list;
  };

  const activeCount = () => (state.cat !== 'all') + !!state.q + (state.origin !== 'all') + state.saved;

  function renderControls() {
    const all = catalog.list();
    $('[data-shop-total]').textContent = all.length;
    search.placeholder = `Search ${all.length} fragrances`;

    const byCat = filtered('cat').map((x) => x.p);
    tabsEl.innerHTML = TABS.map((t) => {
      const n = t.key === 'all' ? byCat.length : byCat.filter((p) => p.category === t.key).length;
      const on = t.key === state.cat;
      return `<button type="button" role="tab" class="shop__tab${on ? ' is-active' : ''}" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-tab="${t.key}">${t.label}<small>${n}</small></button>`;
    }).join('');

    const byOrigin = filtered('origin').map((x) => x.p);
    chipsEl.innerHTML = ORIGINS.map((o) => {
      const n = byOrigin.filter((p) => (o.key === 'inspired' ? p.inspired : !p.inspired)).length;
      const on = state.origin === o.key;
      return `<button type="button" class="chip${on ? ' is-on' : ''}" aria-pressed="${on}" data-origin="${o.key}">${o.label}<small>${n}</small></button>`;
    }).join('') + `<button type="button" class="chip chip--saved${state.saved ? ' is-on' : ''}" aria-pressed="${state.saved}" data-saved>${ICON_HEART}Saved<small data-saved-count>${wishlist.size}</small></button>`;

    // price sorts only make sense once something is priced
    const priced = anyPriced();
    $$('option[data-needs-price]', sort).forEach((o) => { o.hidden = !priced; o.disabled = !priced; });
    sort.value = state.sort.startsWith('price') && !priced ? 'featured' : state.sort;

    $$('[data-view]', viewEl).forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === state.view));
    grid.classList.toggle('is-list', state.view === 'list');
    clear.hidden = !search.value;

    // summary of what's filtering the list, each removable
    const pills = [];
    if (state.cat !== 'all') pills.push(['cat', `${CATEGORY_LABEL[state.cat]} collection`]);
    if (state.origin !== 'all') pills.push(['origin', ORIGINS.find((o) => o.key === state.origin).label]);
    if (state.saved) pills.push(['saved', 'Saved']);
    if (state.q) pills.push(['q', `“${state.q}”`]);
    activeEl.hidden = !pills.length;
    activeEl.innerHTML = pills.map(([k, label]) => `<button type="button" class="pill" data-unset="${k}" aria-label="Remove filter: ${esc(label)}">${esc(label)}<span aria-hidden="true">×</span></button>`).join('')
      + (pills.length > 1 ? '<button type="button" class="pill pill--clear" data-reset>Clear all</button>' : '');
  }

  function renderEmpty(list) {
    none.hidden = list.length > 0;
    if (list.length) return;
    const qEl = $('[data-shop-none-q]', none);
    const hint = $('[data-shop-suggest]', none);
    if (state.saved && !wishlist.size) {
      qEl.textContent = 'your wishlist yet';
      hint.innerHTML = 'Tap the ♥ on any fragrance to keep it here.';
      return;
    }
    qEl.textContent = state.q ? `“${state.q}”` : 'these filters';
    const ideas = state.q ? suggest(state.q, catalog.list()) : [];
    hint.innerHTML = ideas.length
      ? `Did you mean ${ideas.map((p) => `<button type="button" class="link-quiet" data-suggest="${esc(p.name)}">${esc(p.name)}</button>`).join(', ')}?`
      : 'Try another name, or clear the filters to see the whole collection.';
  }

  function render({ append = false } = {}) {
    const list = results();
    const visible = list.slice(0, state.shown);
    const start = append ? grid.children.length : 0;
    const html = visible.slice(start).map((p) => productCard(p, state.q)).join('');
    if (append) grid.insertAdjacentHTML('beforeend', html);
    else grid.innerHTML = html;
    markLoaded(grid);

    renderEmpty(list);
    const remaining = list.length - visible.length;
    more.hidden = remaining <= 0;
    $('[data-shop-remaining]', more).textContent = `(${remaining})`;
    countEl.textContent = list.length ? `${visible.length} of ${list.length}` : 'No matches';

    const fresh = [...grid.children].slice(start);
    if (fresh.length) gsap.fromTo(fresh, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.025, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    refreshSoon();
  }

  // filters live in the address bar (shareable, survives a reload)
  let urlTimer = null;
  function syncURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href);
      ['c', 'o', 'q', 'saved', 's', 'v', 'p'].forEach((k) => u.searchParams.delete(k));
      if (state.cat !== 'all') u.searchParams.set('c', state.cat);
      if (state.origin !== 'all') u.searchParams.set('o', state.origin);
      if (state.q) u.searchParams.set('q', state.q);
      if (state.saved) u.searchParams.set('saved', '1');
      if (state.sort !== 'featured') u.searchParams.set('s', state.sort);
      if (activeCount()) u.hash = 'shop';
      history.replaceState(history.state, '', u);
    }, 250);
  }

  // when the sticky bar is pinned and the list changes, return to the top of the grid
  const toGridTop = () => {
    if (section.getBoundingClientRect().top < 0 && grid.getBoundingClientRect().top < controls.offsetHeight) {
      lenis?.scrollTo(grid, { offset: -controls.offsetHeight - 24, duration: 1 });
    }
  };
  const update = ({ keepScroll = false } = {}) => {
    state.shown = page();
    state.autoPages = 0;
    renderControls();
    render();
    syncURL();
    if (!keepScroll) toGridTop();
  };

  // collections: click, and arrow keys between tabs (ARIA tabs pattern)
  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab || tab.dataset.tab === state.cat) return;
    state.cat = tab.dataset.tab;
    update();
    $(`[data-tab="${state.cat}"]`, tabsEl)?.focus({ preventScroll: true });
  });
  tabsEl.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const keys = TABS.map((t) => t.key);
    const i = keys.indexOf(state.cat);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
    $(`[data-tab="${keys[next]}"]`, tabsEl).click();
  });

  chipsEl.addEventListener('click', (e) => {
    const o = e.target.closest('[data-origin]');
    if (o) {
      state.origin = state.origin === o.dataset.origin ? 'all' : o.dataset.origin;
      return update();
    }
    if (e.target.closest('[data-saved]')) {
      state.saved = !state.saved;
      update();
    }
  });

  activeEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) return resetAll();
    const k = e.target.closest('[data-unset]')?.dataset.unset;
    if (!k) return;
    if (k === 'q') search.value = '';
    state[k] = DEFAULTS[k];
    update();
  });

  function resetAll() {
    Object.assign(state, DEFAULTS);
    search.value = '';
    update();
  }
  $('[data-shop-reset]', none).addEventListener('click', resetAll);
  none.addEventListener('click', (e) => {
    const s = e.target.closest('[data-suggest]');
    if (!s) return;
    search.value = s.dataset.suggest;
    state.q = s.dataset.suggest;
    update({ keepScroll: true });
  });

  let searchTimer = null;
  search.addEventListener('input', () => {
    clear.hidden = !search.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = search.value.trim().slice(0, 60);
      update({ keepScroll: true });
    }, 140);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) clear.click();
    if (e.key === 'Enter') {
      search.blur();
      toGridTop();
    }
  });
  clear.addEventListener('click', () => {
    search.value = '';
    state.q = '';
    update({ keepScroll: true });
    search.focus();
  });
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    update();
  });
  viewEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === state.view) return;
    state.view = b.dataset.view;
    store.set('raza-shop-view', state.view);
    update({ keepScroll: true });
  });

  // "/" jumps to search from anywhere (unless typing or a panel is open)
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const html = document.documentElement;
    if (html.classList.contains('qv-open') || html.classList.contains('cart-open') || html.classList.contains('menu-open') || html.classList.contains('is-loading')) return;
    e.preventDefault();
    if (section.getBoundingClientRect().top > innerHeight || section.getBoundingClientRect().bottom < 0) {
      lenis?.scrollTo(section, { duration: 1.4, onComplete: () => search.focus({ preventScroll: true }) });
    } else search.focus();
  });

  const loadMore = () => {
    if (more.hidden) return;
    state.shown += page();
    render({ append: true });
  };
  more.addEventListener('click', loadMore);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && state.autoPages < AUTO_PAGES && !more.hidden) {
      state.autoPages += 1;
      loadMore();
    }
  }, { rootMargin: '0px 0px 500px 0px' }).observe(more);

  grid.addEventListener('click', (e) => {
    const save = e.target.closest('[data-save]');
    if (save) return toggleSaved(save.dataset.save);
    const view = e.target.closest('[data-view]');
    if (view) return quickView.open(view.dataset.view, results());
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) return added(catalog.get(addBtn.dataset.add));
    const inc = e.target.closest('[data-inc]');
    if (inc) return added(catalog.get(inc.dataset.inc));
    const dec = e.target.closest('[data-dec]');
    if (dec) cart.set(dec.dataset.dec, cart.qtyOf(dec.dataset.dec) - 1);
  });

  // cards reflect the bag: "Add" becomes a quantity stepper
  cart.subscribe(() => withFocus(() => {
    $$('[data-buy]', grid).forEach((el) => {
      const p = catalog.get(el.dataset.buy);
      if (p) el.innerHTML = buyControl(p);
    });
  }));
  // hearts, the Saved count, and the Saved view follow the wishlist
  wishlist.subscribe(() => {
    $$('[data-save]', grid).forEach((b) => {
      const on = wishlist.has(b.dataset.save);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on);
    });
    const n = $('[data-saved-count]', chipsEl);
    if (n) n.textContent = wishlist.size;
    if (state.saved) {
      renderControls();
      render();
    }
  });

  // sticky bar gets a backdrop once it's pinned
  new IntersectionObserver(([e]) => controls.classList.toggle('is-stuck', e.intersectionRatio < 1), {
    threshold: [1], rootMargin: '-1px 0px 0px 0px',
  }).observe(controls);

  renderControls();
  render();
  return { rerender: () => { renderControls(); render(); } };
}

/* --------------------------------------------------------------- quick view */

function initQuickView({ lenis }) {
  const root = $('[data-qv]');
  const media = $('[data-qv-media]', root);
  const relatedWrap = $('[data-qv-related-wrap]', root);
  const q = { list: [], index: 0, qty: 1, lastFocus: null };
  const current = () => q.list[q.index];

  function renderRelated(p) {
    if (p.category === 'house') {
      relatedWrap.hidden = true;
      return;
    }
    const same = catalog.list().filter((x) => x.category === p.category);
    const at = same.findIndex((x) => x.id === p.id);
    const picks = [1, 2, 3, 4].map((k) => same[(at + k) % same.length]).filter((x) => x && x.id !== p.id);
    relatedWrap.hidden = !picks.length;
    $('[data-qv-related-title]', root).textContent = `More from the ${collectionOf(p).toLowerCase()}`;
    const list = $('[data-qv-related]', root);
    list.innerHTML = picks.map((x) => `<button type="button" class="qv__rel" data-rel="${esc(x.id)}">${photo(x, 'qv__rel-img')}<span>${esc(x.name)}</span></button>`).join('');
    markLoaded(list);
  }

  function render() {
    const p = current();
    const inBag = cart.qtyOf(p.id);
    const room = Math.max(0, limitFor(p.id) - inBag);
    q.qty = Math.max(1, Math.min(q.qty, room || 1));
    media.innerHTML = photo(p, 'qv__img', { eager: true, alt: p.name });
    markLoaded(media);
    $('[data-qv-eyebrow]', root).textContent = `${collectionOf(p)} · No. ${pad(p.number)}`;
    $('[data-qv-title]', root).textContent = p.name;
    $('[data-qv-tag]', root).hidden = !p.inspired;
    $('[data-qv-desc]', root).textContent = describe(p);
    const price = $('[data-qv-price]', root);
    price.textContent = priceText(p);
    price.classList.toggle('is-request', p.price == null);
    $('[data-qv-priceinfo]', root).hidden = p.price != null;
    $('[data-qv-stock]', root).textContent = soldOut(p) ? 'Sold out' : lowStock(p) ? `Only ${p.stock} left` : p.stock != null ? 'In stock' : '';
    $('[data-qv-stock]', root).className = `qv__stock${soldOut(p) ? ' is-out' : lowStock(p) ? ' is-low' : ''}`;
    $('[data-qv-qty]', root).textContent = q.qty;
    $('[data-qv-minus]', root).disabled = q.qty <= 1;
    $('[data-qv-plus]', root).disabled = q.qty >= room;
    const addBtn = $('[data-qv-add]', root);
    addBtn.disabled = soldOut(p) || room === 0;
    $('.btn__label', addBtn).textContent = soldOut(p) ? 'Sold out' : room === 0 ? 'All in your bag' : 'Add to bag';
    const ask = $('[data-qv-ask]', root);
    ask.href = askUrl(p);
    $('[data-qv-ask-label]', root).textContent = soldOut(p) ? 'Ask about availability on WhatsApp' : p.price == null ? 'Ask the price on WhatsApp' : 'Ask about this fragrance on WhatsApp';
    const save = $('[data-qv-save]', root);
    const on = wishlist.has(p.id);
    save.classList.toggle('is-on', on);
    save.setAttribute('aria-pressed', on);
    save.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
    $('[data-qv-inbag]', root).textContent = inBag ? `${inBag} in your bag` : '';
    $('[data-qv-prev]', root).disabled = q.index === 0;
    $('[data-qv-next]', root).disabled = q.index === q.list.length - 1;
    $('[data-qv-pos]', root).textContent = q.list.length > 1 ? `${q.index + 1} / ${q.list.length}` : '';
    renderRelated(p);
  }

  function open(id, list) {
    const p = catalog.get(id);
    if (!p) return;
    q.list = list?.some((x) => x.id === id) ? list : [p];
    q.index = q.list.findIndex((x) => x.id === id);
    q.qty = 1;
    if (!root.classList.contains('is-open')) q.lastFocus = document.activeElement;
    render();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('qv-open');
    lenis?.stop();
    $('.qv__info', root).scrollTop = 0;
    setTimeout(() => ($('[data-qv-add]', root).disabled ? $('[data-qv-ask]', root) : $('[data-qv-add]', root)).focus(), 60);
  }

  function close() {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('qv-open');
    lenis?.start();
    q.lastFocus?.focus?.();
  }

  const step = (d) => {
    const i = q.index + d;
    if (i < 0 || i >= q.list.length) return;
    q.index = i;
    q.qty = 1;
    render();
    gsap.fromTo(media.firstElementChild, { autoAlpha: 0, x: 30 * d }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out' });
  };

  $$('[data-qv-close]', root).forEach((b) => b.addEventListener('click', close));
  $('[data-qv-prev]', root).addEventListener('click', () => step(-1));
  $('[data-qv-next]', root).addEventListener('click', () => step(1));
  $('[data-qv-minus]', root).addEventListener('click', () => { q.qty = Math.max(1, q.qty - 1); render(); });
  $('[data-qv-plus]', root).addEventListener('click', () => { q.qty += 1; render(); });
  $('[data-qv-add]', root).addEventListener('click', () => {
    added(current(), q.qty);
    q.qty = 1;
    render();
  });
  $('[data-qv-save]', root).addEventListener('click', () => toggleSaved(current().id));
  $('[data-qv-related]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-rel]');
    if (!b) return;
    const i = q.list.findIndex((x) => x.id === b.dataset.rel);
    if (i >= 0) step(i - q.index);
    else open(b.dataset.rel, catalog.list());
  });
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') trapFocus(e, $('.qv__panel', root));
  });
  // swipe between products on touch screens
  let x0 = null;
  media.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  media.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
  // share a direct link to this fragrance (opens straight into quick view)
  $('[data-qv-share]', root).addEventListener('click', async () => {
    const p = current();
    const url = `${location.origin}${location.pathname}?p=${encodeURIComponent(p.id)}`;
    const data = { title: `${p.name} · Raza Perfume`, text: `${p.name} from the House of Raza`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast(p, 'Link copied, ready to share', { cta: null });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast(p, url, { cta: null });
    }
  });

  cart.subscribe(() => root.classList.contains('is-open') && render());
  wishlist.subscribe(() => root.classList.contains('is-open') && render());
  return { open };
}

function trapFocus(e, container) {
  const nodes = $$('button:not([disabled]), a[href], input, select', container).filter((n) => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ------------------------------------------------------------------- drawer */

function initDrawer({ lenis }) {
  const root = $('[data-cart]');
  const panel = $('.cart__panel', root);
  const list = $('[data-cart-list]');
  const empty = $('[data-cart-empty]');
  const total = $('[data-cart-total]');
  const countEls = $$('[data-cart-count]');
  const badge = $('[data-bag-count]');
  const form = $('[data-cart-form]');
  const errorEl = $('[data-cart-error]');
  const done = $('[data-cart-done]');
  const submitBtn = form.querySelector('[type="submit"]');
  let lastFocus = null;

  function render() {
    const items = cart.items;
    const count = cart.count();
    list.innerHTML = items.map(({ id, qty }) => {
      const p = catalog.get(id);
      if (!p) return '';
      const line = p.price != null ? fmt(p.price * qty) : 'On request';
      const atMax = qty >= limitFor(id);
      return `<li class="cart__item" data-id="${esc(id)}">
        <div class="cart__thumb">${photo(p, 'cart__img')}</div>
        <div class="cart__info">
          <p class="cart__name">${esc(p.name)}</p>
          <p class="cart__meta">${collectionOf(p)}${lowStock(p) ? ` · <span class="cart__low">only ${p.stock} left</span>` : ''}</p>
          <div class="stepper stepper--sm" role="group" aria-label="Quantity of ${esc(p.name)}">
            <button type="button" data-dec aria-label="One less">−</button><span>${qty}</span><button type="button" data-inc aria-label="One more"${atMax ? ' disabled' : ''}>+</button>
          </div>
        </div>
        <div class="cart__side">
          <span class="cart__line">${line}</span>
          <button type="button" class="cart__remove" data-remove aria-label="Remove ${esc(p.name)}">Remove</button>
        </div>
      </li>`;
    }).join('');
    markLoaded(list);
    empty.hidden = items.length > 0;
    form.hidden = items.length === 0;
    const { subtotal, unpriced } = cart.totals();
    total.textContent = subtotal > 0 ? (unpriced ? `${fmt(subtotal)} + on request` : fmt(subtotal)) : items.length ? 'Price on request' : fmt(0);
    countEls.forEach((el) => (el.textContent = `(${count})`));
    badge.textContent = count;
    badge.classList.toggle('has-items', count > 0);
    $('[data-bag-fab-count]').textContent = count;
    document.documentElement.classList.toggle('has-bag', count > 0);
  }

  const open = () => {
    lastFocus = document.activeElement;
    done.hidden = true;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('cart-open');
    lenis?.stop();
    setTimeout(() => $('.cart__close', root)?.focus(), 60);
  };
  const close = () => {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('cart-open');
    lenis?.start();
    lastFocus?.focus?.();
  };

  $$('[data-bag]').forEach((b) => b.addEventListener('click', open));
  $$('[data-cart-close]', root).forEach((b) => b.addEventListener('click', close));
  $('[data-toast]').addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') trapFocus(e, panel);
  });
  $('[data-cart-browse]', root)?.addEventListener('click', () => {
    close();
    lenis?.scrollTo('#shop', { duration: 1.8 });
  });

  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-id]');
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.closest('[data-inc]')) cart.set(id, cart.qtyOf(id) + 1);
    else if (e.target.closest('[data-dec]')) cart.set(id, cart.qtyOf(id) - 1);
    else if (e.target.closest('[data-remove]')) cart.set(id, 0);
  });

  // remember contact details on this device for next time
  const PROFILE = 'raza-customer-v1';
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE) || '{}');
    for (const k of ['name', 'phone', 'city']) if (saved[k]) form.elements[k].value = saved[k];
  } catch { /* storage unavailable */ }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const customer = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      city: form.elements.city.value.trim(),
      note: form.elements.note.value.trim(),
    };
    if (customer.name.length < 2) return fail('Please enter your name.', 'name');
    const digits = customer.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return fail('Please enter a valid phone number.', 'phone');

    const lines = cart.items.map((i) => ({ id: i.id, qty: i.qty }));
    // desktop: open the WhatsApp tab inside the click so it isn't popup-blocked
    const popup = isTouch() ? null : window.open('', '_blank');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn__label').textContent = 'Placing order…';

    let order = null;
    try {
      order = await submitOrder(customer, lines);
    } catch (err) {
      if (err.invalidInput) {
        popup?.close();
        resetButton();
        return fail(err.message);
      }
      // backend unreachable: never lose the sale — still send it on WhatsApp
      console.warn('[raza] order could not be saved, sending via WhatsApp only', err);
    }

    try {
      localStorage.setItem(PROFILE, JSON.stringify({ name: customer.name, phone: customer.phone, city: customer.city }));
    } catch { /* storage unavailable */ }

    const url = whatsappUrl(orderMessage(customer, order));
    if (popup) {
      popup.opener = null;
      popup.location.href = url;
    } else {
      window.location.href = url;
    }
    cart.clear();
    form.elements.note.value = '';
    resetButton();
    done.hidden = false;
    $('[data-cart-done-number]', done).textContent = order ? `Order #${order.number}` : 'Order';
    $('[data-cart-done-link]', done).href = url;
  });

  function fail(message, field) {
    errorEl.textContent = message;
    if (field) form.elements[field].focus();
  }
  function resetButton() {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn__label').textContent = 'Place order on WhatsApp';
  }

  cart.subscribe(render);
  render();
  return { render, open };
}

function orderMessage(customer, order) {
  const lines = ['Hello Raza Perfume! I would like to place an order.'];
  if (order) lines.push(`Order #${order.number}`);
  lines.push('');
  cart.items.forEach(({ id, qty }, i) => {
    const p = catalog.get(id);
    const price = p.price != null ? ` — ${fmt(p.price * qty)}` : ' — price on request';
    lines.push(`${i + 1}. ${p.name} (${collectionOf(p)}, No. ${pad(p.number)}) × ${qty}${price}`);
  });
  const { subtotal, unpriced } = cart.totals();
  lines.push('');
  if (subtotal > 0) lines.push(`Subtotal: ${fmt(subtotal)}${unpriced ? ' + items on request' : ''}`);
  else lines.push('Please share prices and availability.');
  lines.push('', `Name: ${customer.name}`, `Phone: ${customer.phone}`);
  if (customer.city) lines.push(`City: ${customer.city}`);
  if (customer.note) lines.push(`Note: ${customer.note}`);
  return lines.join('\n');
}

/* --------------------------------------------------------------------- init */

export function initShop({ lenis }) {
  watchPhotos();
  wishlist.prune((id) => Boolean(catalog.get(id)));
  const quickView = initQuickView({ lenis });
  const grid = initGrid({ lenis, quickView });
  const drawer = initDrawer({ lenis });

  if (!SHOP.whatsapp) console.warn('[raza] VITE_WHATSAPP_NUMBER is not set — orders open WhatsApp without a recipient.');
  else $$('a[aria-label="WhatsApp"]').forEach((a) => (a.href = `https://wa.me/${SHOP.whatsapp}`));

  // nav "Search" jumps into the Atelier and focuses the search field
  $$('[data-shop-jump]').forEach((b) => b.addEventListener('click', () => {
    lenis?.scrollTo('#shop', { duration: 1.6, onComplete: () => $('[data-shop-search]').focus({ preventScroll: true }) });
  }));

  // live prices, stock, photos & products from Supabase, when configured
  if (backendEnabled()) {
    fetchCatalog()
      .then((rows) => {
        if (!rows?.length) return;
        catalog.merge(rows);
        cart.revalidate();
        grid.rerender();
        drawer.render();
      })
      .catch((err) => console.warn('[raza] could not load live catalogue, using bundled list', err));
  }

  return {
    add(id) {
      const p = catalog.get(id);
      if (p) added(p);
    },
    // deep links (?p=<id>) open with the whole catalogue for prev/next
    view: (id) => quickView.open(id, catalog.list()),
  };
}
