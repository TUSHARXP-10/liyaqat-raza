import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SHOP } from '../content.js';
import { CATEGORY_LABEL } from './products.js';
import { catalog } from './catalog.js';
import { cart } from './cart.js';
import { tintFor, imageFor } from './look.js';
import { backendEnabled, fetchCatalog, submitOrder } from './backend.js';

// Chapter VI · The Atelier — catalogue grid, quick view, bag drawer, checkout.
// Checkout saves the order to Supabase (when configured) and then opens
// WhatsApp with the order ready to send to the shop.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'luxury', label: 'Luxury' },
  { key: 'premium', label: 'Premium' },
  { key: 'regular', label: 'Regular' },
];
const AUTO_PAGES = 3; // load-on-scroll this many pages, then hand over to the button

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (n) => money.format(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
const qtyOf = (id) => cart.items.find((i) => i.id === id)?.qty || 0;
const priceText = (p) => (p.price != null ? fmt(p.price) : 'Price on request');
const collectionOf = (p) => (p.category === 'house' ? 'House signature' : `${CATEGORY_LABEL[p.category]} collection`);

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

function buyControl(p) {
  const q = qtyOf(p.id);
  if (!q) return `<button class="product__add" type="button" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag"><span aria-hidden="true">+</span> Add</button>`;
  return `<div class="stepper" role="group" aria-label="${esc(p.name)} in your bag">
    <button type="button" data-dec="${esc(p.id)}" aria-label="One less ${esc(p.name)}">−</button>
    <span>${q}</span>
    <button type="button" data-inc="${esc(p.id)}" aria-label="One more ${esc(p.name)}">+</button>
  </div>`;
}

function productCard(p) {
  return `<article class="product" data-id="${esc(p.id)}">
  <button class="product__media" type="button" data-view="${esc(p.id)}" aria-label="Quick view: ${esc(p.name)}">
    ${photo(p, 'product__img')}
    <span class="product__no">No. ${String(p.number).padStart(2, '0')}</span>
    ${p.inspired ? '<span class="product__badge">Inspired</span>' : ''}
    <span class="product__quick" aria-hidden="true">Quick view</span>
  </button>
  <div class="product__body">
    <h3 class="product__name"><button type="button" data-view="${esc(p.id)}">${esc(p.name)}</button></h3>
    <p class="product__meta">${collectionOf(p)}${p.sizeMl ? ` · ${p.sizeMl} ml` : ''}</p>
    <div class="product__foot">
      <span class="product__price${p.price == null ? ' is-request' : ''}">${priceText(p)}</span>
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
function toast(p, message) {
  const el = $('[data-toast]');
  el.innerHTML = `${p ? photo(p, 'toast__img', { eager: true }) : ''}<span class="toast__text">${esc(message)}</span><span class="toast__cta">View bag</span>`;
  markLoaded(el);
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
}

function added(p, qty = 1) {
  cart.add(p.id, qty);
  toast(p, qty > 1 ? `${qty} × ${p.name} added` : `${p.name} added to your bag`);
  // bump the nav badge; clearProps hands scale back to CSS so an empty bag hides it
  gsap.fromTo('[data-bag-count], [data-bag-fab-count]', { scale: 1.9 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)', clearProps: 'transform' });
}

// keep keyboard focus on the same control when a stepper re-renders
function withFocus(fn) {
  const a = document.activeElement;
  const id = a?.dataset?.inc || a?.dataset?.dec || a?.dataset?.add;
  const kind = a?.dataset?.inc ? 'inc' : a?.dataset?.dec ? 'dec' : a?.dataset?.add ? 'add' : null;
  fn();
  if (!id) return;
  const scope = a.closest('[data-qv]') ? $('[data-qv]') : document;
  const next = $(`[data-${kind}="${CSS.escape(id)}"]`, scope) || $(`[data-inc="${CSS.escape(id)}"]`, scope) || $(`[data-add="${CSS.escape(id)}"]`, scope);
  next?.focus();
}

/* --------------------------------------------------------------------- grid */

function initGrid({ lenis, quickView }) {
  const section = $('#shop');
  const grid = $('[data-shop-grid]');
  const tabsEl = $('[data-shop-tabs]');
  const search = $('[data-shop-search]');
  const clear = $('[data-shop-clear]');
  const sort = $('[data-shop-sort]');
  const countEl = $('[data-shop-count]');
  const controls = $('.shop__controls');
  const more = $('[data-shop-more]');
  const none = $('[data-shop-none]');
  const state = { cat: 'all', q: '', sort: 'featured', shown: SHOP.pageSize, autoPages: 0 };

  let refreshTimer = null;
  const refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 220);
  };

  const byPrice = (dir) => (a, b) => (a.price == null) - (b.price == null) || (a.price - b.price) * dir || a.name.localeCompare(b.name);
  const matches = () => {
    const q = norm(state.q);
    const list = catalog.list().filter((p) =>
      (state.cat === 'all' || p.category === state.cat) && (!q || norm(p.name).includes(q) || norm(p.sheetName).includes(q)));
    if (state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === 'za') list.sort((a, b) => b.name.localeCompare(a.name));
    else if (state.sort === 'price-asc') list.sort(byPrice(1));
    else if (state.sort === 'price-desc') list.sort(byPrice(-1));
    return list;
  };

  function renderTabs() {
    const all = catalog.list();
    tabsEl.innerHTML = TABS.map((t) => {
      const n = t.key === 'all' ? all.length : all.filter((p) => p.category === t.key).length;
      const on = t.key === state.cat;
      return `<button type="button" role="tab" class="shop__tab${on ? ' is-active' : ''}" aria-selected="${on}" data-tab="${t.key}">${t.label}<small>${n}</small></button>`;
    }).join('');
    $('[data-shop-total]').textContent = all.length;
  }

  function render({ append = false } = {}) {
    const list = matches();
    const visible = list.slice(0, state.shown);
    const start = append ? grid.children.length : 0;
    if (append) grid.insertAdjacentHTML('beforeend', visible.slice(start).map(productCard).join(''));
    else grid.innerHTML = visible.map(productCard).join('');
    markLoaded(grid);

    none.hidden = list.length > 0;
    $('span', none).textContent = state.q;
    const remaining = list.length - visible.length;
    more.hidden = remaining <= 0;
    $('[data-shop-remaining]', more).textContent = `(${remaining})`;
    countEl.textContent = list.length ? `Showing ${visible.length} of ${list.length}` : 'No matches';
    clear.hidden = !state.q;

    const fresh = [...grid.children].slice(start);
    if (fresh.length) gsap.fromTo(fresh, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.03, ease: 'expo.out', clearProps: 'transform' });
    refreshSoon();
  }

  // when the sticky bar is pinned and the list changes, return to the top of the grid
  const toGridTop = () => {
    if (section.getBoundingClientRect().top < 0) lenis?.scrollTo(grid, { offset: -controls.offsetHeight - 24, duration: 1.1 });
  };
  const reset = () => {
    state.shown = SHOP.pageSize;
    state.autoPages = 0;
    render();
    toGridTop();
  };

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab || tab.dataset.tab === state.cat) return;
    state.cat = tab.dataset.tab;
    renderTabs();
    reset();
  });

  let searchTimer = null;
  search.addEventListener('input', () => {
    clear.hidden = !search.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = search.value.trim();
      reset();
    }, 160);
  });
  search.addEventListener('keydown', (e) => e.key === 'Escape' && search.value && clear.click());
  clear.addEventListener('click', () => {
    search.value = '';
    state.q = '';
    reset();
    search.focus();
  });
  sort.addEventListener('change', () => {
    state.sort = sort.value;
    reset();
  });

  const loadMore = () => {
    if (more.hidden) return;
    state.shown += SHOP.pageSize;
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
    const view = e.target.closest('[data-view]');
    if (view) return quickView.open(view.dataset.view, matches());
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) return added(catalog.get(addBtn.dataset.add));
    const inc = e.target.closest('[data-inc]');
    if (inc) return cart.set(inc.dataset.inc, qtyOf(inc.dataset.inc) + 1);
    const dec = e.target.closest('[data-dec]');
    if (dec) cart.set(dec.dataset.dec, qtyOf(dec.dataset.dec) - 1);
  });

  // cards reflect the bag: "Add" becomes a quantity stepper
  cart.subscribe(() => withFocus(() => {
    $$('[data-buy]', grid).forEach((el) => {
      const p = catalog.get(el.dataset.buy);
      if (p) el.innerHTML = buyControl(p);
    });
  }));

  // sticky bar gets a backdrop once it's pinned
  new IntersectionObserver(([e]) => controls.classList.toggle('is-stuck', e.intersectionRatio < 1), {
    threshold: [1], rootMargin: '-1px 0px 0px 0px',
  }).observe(controls);

  renderTabs();
  render();
  return { rerender: () => { renderTabs(); render(); } };
}

/* --------------------------------------------------------------- quick view */

function initQuickView({ lenis }) {
  const root = $('[data-qv]');
  const media = $('[data-qv-media]', root);
  const q = { list: [], index: 0, qty: 1, lastFocus: null };

  function render() {
    const p = q.list[q.index];
    media.innerHTML = photo(p, 'qv__img', { eager: true, alt: p.name });
    markLoaded(media);
    $('[data-qv-eyebrow]', root).textContent = `${collectionOf(p)} · No. ${String(p.number).padStart(2, '0')}`;
    $('[data-qv-title]', root).textContent = p.name;
    $('[data-qv-tag]', root).hidden = !p.inspired;
    $('[data-qv-desc]', root).textContent = describe(p);
    $('[data-qv-price]', root).textContent = priceText(p);
    $('[data-qv-price]', root).classList.toggle('is-request', p.price == null);
    $('[data-qv-priceinfo]', root).hidden = p.price != null;
    $('[data-qv-qty]', root).textContent = q.qty;
    const inBag = qtyOf(p.id);
    $('[data-qv-inbag]', root).textContent = inBag ? `${inBag} already in your bag` : '';
    $('[data-qv-prev]', root).disabled = q.index === 0;
    $('[data-qv-next]', root).disabled = q.index === q.list.length - 1;
    $('[data-qv-pos]', root).textContent = q.list.length > 1 ? `${q.index + 1} / ${q.list.length}` : '';
  }

  function open(id, list) {
    const p = catalog.get(id);
    if (!p) return;
    q.list = list?.some((x) => x.id === id) ? list : [p];
    q.index = q.list.findIndex((x) => x.id === id);
    q.qty = 1;
    q.lastFocus = document.activeElement;
    render();
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('qv-open');
    lenis?.stop();
    setTimeout(() => $('[data-qv-add]', root).focus(), 60);
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
  $('[data-qv-plus]', root).addEventListener('click', () => { q.qty = Math.min(99, q.qty + 1); render(); });
  $('[data-qv-add]', root).addEventListener('click', () => {
    added(q.list[q.index], q.qty);
    q.qty = 1;
    render();
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
  cart.subscribe(() => root.classList.contains('is-open') && render());
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
      return `<li class="cart__item" data-id="${esc(id)}">
        <div class="cart__thumb">${photo(p, 'cart__img')}</div>
        <div class="cart__info">
          <p class="cart__name">${esc(p.name)}</p>
          <p class="cart__meta">${collectionOf(p)}</p>
          <div class="stepper stepper--sm" role="group" aria-label="Quantity of ${esc(p.name)}">
            <button type="button" data-dec aria-label="One less">−</button><span>${qty}</span><button type="button" data-inc aria-label="One more">+</button>
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
    if (e.target.closest('[data-inc]')) cart.set(id, qtyOf(id) + 1);
    else if (e.target.closest('[data-dec]')) cart.set(id, qtyOf(id) - 1);
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
    lines.push(`${i + 1}. ${p.name} (${collectionOf(p)}) × ${qty}${price}`);
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

function whatsappUrl(text) {
  const base = SHOP.whatsapp ? `https://wa.me/${SHOP.whatsapp}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/* --------------------------------------------------------------------- init */

export function initShop({ lenis }) {
  watchPhotos();
  const quickView = initQuickView({ lenis });
  const grid = initGrid({ lenis, quickView });
  const drawer = initDrawer({ lenis });

  if (!SHOP.whatsapp) console.warn('[raza] VITE_WHATSAPP_NUMBER is not set — orders open WhatsApp without a recipient.');
  else $$('a[aria-label="WhatsApp"]').forEach((a) => (a.href = `https://wa.me/${SHOP.whatsapp}`));

  // live prices, photos & products from Supabase, when configured
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
    view: (id) => quickView.open(id),
  };
}
