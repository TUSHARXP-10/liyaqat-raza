import { catalog } from '../shop/catalog.js';
import { cart, limitFor } from '../shop/cart.js';
import { wishlist } from '../shop/wishlist.js';
import { CATEGORY_LABEL, TYPE_NOTE, typeLabel, hasSizes, variantOf } from '../shop/products.js';
import { imageFor, photosOf, assetBase } from '../shop/look.js';
import { backendEnabled, fetchCatalog, fetchFilms } from '../shop/backend.js';
import { initBag, added, askUrl, pickSize } from '../shop/shop.js';
import { loadContent, applyContent, cms } from '../cms/content.js';
import { REELS } from '../blog/reels.js';
import MEDIA from '../blog/media.json' with { type: 'json' };
import { initCursor } from '../ui/cursor.js';
import { SHOP } from '../content.js';

// A page per fragrance: /p/<id>. Gallery (photos + films), the Perfume /
// Attar and size picker, add to bag, ask on WhatsApp, related fragrances.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmt = (n) => money.format(n);
const pad = (n) => String(n).padStart(2, '0');
const collectionOf = (p) => (p.category === 'house' ? 'House signature' : `${CATEGORY_LABEL[p.category]} collection`);
const soldOut = (p) => p.stock === 0;
const blogFile = (f) => (/^(https?:)?\//.test(f) ? f : `${assetBase()}media/blog/${f}`);
const ICON_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.3-.5-2.4-1.6-2.9-2.9l1-1-1-2z"/></svg>';
const ICON_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';

const wanted = decodeURIComponent(location.pathname.replace(/^\/p\//, '').replace(/\/$/, '')) || new URLSearchParams(location.search).get('id') || '';
const timeout = (ms) => new Promise((r) => setTimeout(() => r(null), ms));

// live data first (prices, photos, copy, films from the admin panel), never waiting long
const [, liveRows, filmRows] = await Promise.all([
  loadContent({ timeout: 2000 }),
  backendEnabled() ? Promise.race([fetchCatalog().catch(() => null), timeout(2500)]) : null,
  backendEnabled() ? Promise.race([fetchFilms().catch(() => null), timeout(2500)]) : null,
]);
if (liveRows?.length) {
  catalog.merge(liveRows);
  cart.revalidate();
}
applyContent();
initBag();
initCursor();

const p = catalog.resolve(wanted);
if (!p || p.active === false) notFound();
else render(p);

function notFound() {
  document.title = 'Fragrance not found · Raza Perfume';
  $('[data-product]').innerHTML = `<div class="pp__missing"><p class="eyebrow">Not found</p><h1 class="pp__title">This fragrance isn’t in the collection</h1><p class="muted">It may have been renamed or retired. Every fragrance we have is in the Atelier.</p><a class="btn btn--solid" href="/#shop"><span class="btn__label">Browse all fragrances</span><span class="btn__arrow" aria-hidden="true">→</span></a></div>`;
}

function films(prod) {
  const list = REELS.filter((r) => r.product === prod.id && MEDIA.reels[r.slug]).map((r) => ({ slug: r.slug, title: r.title, video: blogFile(MEDIA.reels[r.slug].video), poster: blogFile(MEDIA.reels[r.slug].poster) }));
  for (const row of filmRows || []) {
    const i = list.findIndex((f) => f.slug === row.slug);
    if (row.product_id !== prod.id || !row.active) {
      if (i >= 0) list.splice(i, 1); // unlinked or hidden in the admin panel
      continue;
    }
    if (i >= 0) list[i].title = row.title;
    else if (row.video_url) list.push({ slug: row.slug, title: row.title, video: row.video_url, poster: row.poster_url || row.video_url });
  }
  return list;
}

function render(prod) {
  if (prod.id !== wanted) history.replaceState(null, '', `/p/${encodeURIComponent(prod.id)}${location.search}`);
  const photos = photosOf(prod);
  const reels = films(prod);
  const gallery = [
    ...(photos.length ? photos.map((ph, i) => ({ src: imageFor(prod, { size: 'lg', index: i }), thumb: imageFor(prod, { index: i }), alt: ph.alt || prod.name, card: ph.kind === 'card' })) : [{ src: imageFor(prod, { size: 'lg' }), thumb: imageFor(prod), alt: prod.name, render: true }]),
    ...reels.map((f) => ({ film: f, thumb: f.poster, alt: f.title })),
  ];
  const state = {
    v: hasSizes(prod) ? (variantOf(prod, new URLSearchParams(location.search).get('size')) || pickSize(prod, null)).id : null,
    qty: 1,
    at: 0,
  };
  const size = () => variantOf(prod, state.v);

  // crumbs + SEO
  $('[data-crumbs]').innerHTML = `<a href="/">Home</a><span>/</span><a href="/#shop">Shop</a><span>/</span><a href="/?c=${prod.category}#shop">${esc(collectionOf(prod))}</a><span>/</span><b>${esc(prod.name)}</b>`;
  seo(prod, gallery[0]);

  /* ------------------------------------------------------------ gallery */
  const stage = $('[data-stage]');
  const thumbs = $('[data-thumbs]');
  const show = (i) => {
    state.at = (i + gallery.length) % gallery.length;
    const g = gallery[state.at];
    stage.classList.toggle('is-film', Boolean(g.film));
    stage.classList.toggle('is-card', Boolean(g.card));
    stage.classList.toggle('is-render', Boolean(g.render));
    stage.innerHTML = g.film
      ? `<video src="${esc(g.film.video)}" poster="${esc(g.film.poster)}" controls autoplay playsinline aria-label="Film: ${esc(g.film.title)}"></video>`
      : `<img src="${esc(g.src)}" alt="${esc(g.alt)}" width="1200" height="1200" />`;
    $$('button', thumbs).forEach((b, j) => {
      b.classList.toggle('is-on', j === state.at);
      b.setAttribute('aria-pressed', j === state.at);
    });
  };
  thumbs.hidden = gallery.length < 2;
  thumbs.innerHTML = gallery.map((g, i) => `<button type="button" class="pp__thumb${g.film ? ' is-film' : ''}" data-i="${i}" aria-label="${g.film ? `Film: ${esc(g.film.title)}` : `Photo ${i + 1}`}"><img src="${esc(g.thumb)}" alt="" loading="lazy" /></button>`).join('');
  thumbs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) show(Number(b.dataset.i));
  });
  let x0 = null;
  stage.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (x0 === null || gallery.length < 2) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(state.at + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [role="radiogroup"]') || document.documentElement.classList.contains('cart-open')) return;
    if (e.key === 'ArrowRight') show(state.at + 1);
    if (e.key === 'ArrowLeft') show(state.at - 1);
  });
  show(0);

  /* --------------------------------------------------------------- info */
  const info = $('[data-info]');
  const describe = prod.description || (prod.inspired
    ? `Raza’s own interpretation of a much-loved signature, from the ${collectionOf(prod).toLowerCase()}.`
    : `From the House of Raza’s ${collectionOf(prod).toLowerCase()}.`);
  info.innerHTML = `
    <p class="eyebrow">${esc(collectionOf(prod))} · No. ${pad(prod.number)}</p>
    <div class="pp__head">
      <h1 class="pp__title">${esc(prod.name)}</h1>
      <button class="heart heart--lg" type="button" data-save aria-pressed="false" aria-label="Save to wishlist">${ICON_HEART}</button>
    </div>
    ${prod.inspired ? '<p class="qv__tag">Inspired impression</p>' : ''}
    <p class="pp__desc">${esc(describe)}</p>
    <div class="qv__options" data-options ${hasSizes(prod) ? '' : 'hidden'}>
      <div class="qv__opt" data-types-wrap><p class="qv__opt-label" id="pp-type">Choose</p><div class="seg" role="radiogroup" aria-labelledby="pp-type" data-types></div></div>
      <div class="qv__opt"><p class="qv__opt-label" id="pp-size">Size</p><div class="sizes" role="radiogroup" aria-labelledby="pp-size" data-sizes></div></div>
    </div>
    <div class="qv__pricing"><p class="qv__price" data-price></p><p class="qv__unit" data-unit></p><p class="qv__stock" data-stock></p></div>
    <p class="qv__priceinfo" data-priceinfo>Price and availability are confirmed with you on WhatsApp.</p>
    <div class="qv__buy" data-buy-anchor>
      <div class="stepper stepper--lg" role="group" aria-label="Quantity"><button type="button" data-minus aria-label="One less">−</button><span data-qty>1</span><button type="button" data-plus aria-label="One more">+</button></div>
      <button class="btn btn--solid qv__add" type="button" data-add><span class="btn__label">Add to bag</span><span class="btn__arrow" aria-hidden="true">+</span></button>
    </div>
    <a class="qv__ask" href="#" target="_blank" rel="noopener" data-ask>${ICON_WA}<span data-ask-label>Ask on WhatsApp</span></a>
    <p class="qv__inbag" data-inbag aria-live="polite"></p>
    <ul class="qv__assure">
      <li>Order on WhatsApp</li>
      <li>${esc(cms.get('shop.shipping'))}</li>
      <li>Call <a href="tel:${esc(SHOP.phone)}">${esc(SHOP.phoneLabel)}</a></li>
    </ul>
    <div class="pp__actions"><button class="link-quiet" type="button" data-share>${ICON_SHARE} Share</button><a class="link-quiet" href="/#shop">All fragrances</a></div>`;

  const renderBuy = () => {
    const s = size();
    const unit = s ? s.price : prod.price;
    if (hasSizes(prod)) {
      const types = [...new Set(prod.variants.map((v) => v.type))];
      $('[data-types-wrap]').hidden = types.length < 2;
      $('[data-types]').innerHTML = types.map((t) => {
        const on = t === s.type;
        return `<button type="button" role="radio" class="seg__opt${on ? ' is-on' : ''}" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-type="${esc(t ?? '')}"><b>${esc(typeLabel(t))}</b>${TYPE_NOTE[t] ? `<small>${esc(TYPE_NOTE[t])}</small>` : ''}</button>`;
      }).join('');
      $('[data-sizes]').innerHTML = prod.variants.filter((v) => v.type === s.type).map((v) => {
        const on = v.id === s.id;
        const n = cart.qtyOf(prod.id, v.id);
        const price = v.price != null ? fmt(v.price) : 'On request';
        return `<button type="button" role="radio" class="size${on ? ' is-on' : ''}" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-size="${esc(v.id)}" aria-label="${v.ml} ml, ${price}${n ? `, ${n} in your bag` : ''}"><b>${v.ml} ml</b><span>${price}</span>${n ? `<i class="size__in" aria-hidden="true">${n}</i>` : ''}</button>`;
      }).join('');
    }
    const room = Math.max(0, limitFor(prod.id) - cart.qtyOf(prod.id));
    state.qty = Math.max(1, Math.min(state.qty, room || 1));
    const price = $('[data-price]');
    price.textContent = soldOut(prod) ? 'Sold out' : unit != null ? fmt(unit) : 'Price on request';
    price.classList.toggle('is-request', unit == null || soldOut(prod));
    $('[data-unit]').textContent = s ? s.label : '';
    $('[data-stock]').textContent = soldOut(prod) ? '' : prod.stock != null && prod.stock <= 5 ? `Only ${prod.stock} left` : '';
    $('[data-priceinfo]').hidden = unit != null && !soldOut(prod);
    $('[data-qty]').textContent = state.qty;
    $('[data-minus]').disabled = state.qty <= 1;
    $('[data-plus]').disabled = state.qty >= room;
    const add = $('[data-add]');
    add.disabled = soldOut(prod) || room === 0;
    $('.btn__label', add).textContent = soldOut(prod) ? 'Sold out' : room === 0 ? 'All in your bag' : 'Add to bag';
    $('[data-ask]').href = askUrl(prod, s);
    $('[data-ask-label]').textContent = soldOut(prod) ? 'Ask about availability on WhatsApp'
      : unit == null ? `Ask the price${s ? ` of ${s.ml} ml ${typeLabel(s.type).toLowerCase()}`.trimEnd() : ''} on WhatsApp` : 'Ask about this fragrance on WhatsApp';
    const lines = cart.linesOf(prod.id);
    $('[data-inbag]').textContent = !lines.length ? '' : s
      ? `In your bag: ${lines.map((l) => `${variantOf(prod, l.v)?.label} × ${l.qty}`).join(' · ')}`
      : `${cart.qtyOf(prod.id)} in your bag`;
    const on = wishlist.has(prod.id);
    const heart = $('[data-save]');
    heart.classList.toggle('is-on', on);
    heart.setAttribute('aria-pressed', on);
    heart.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
    renderBar();
    // the address keeps the size, so a shared link opens on it
    const u = new URL(location.href);
    if (state.v) u.searchParams.set('size', state.v);
    history.replaceState(null, '', u);
  };

  const pick = (v) => {
    if (!v) return;
    state.v = v.id;
    state.qty = 1;
    renderBuy();
  };
  info.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-type]');
    if (t) {
      const type = t.dataset.type || null;
      const cur = size();
      pick(prod.variants.find((v) => v.type === type && v.ml === cur?.ml) || prod.variants.find((v) => v.type === type));
      return $('.seg__opt.is-on', info)?.focus();
    }
    const s = e.target.closest('[data-size]');
    if (s) {
      pick(variantOf(prod, s.dataset.size));
      return $('.size.is-on', info)?.focus();
    }
    if (e.target.closest('[data-minus]')) {
      state.qty = Math.max(1, state.qty - 1);
      return renderBuy();
    }
    if (e.target.closest('[data-plus]')) {
      state.qty += 1;
      return renderBuy();
    }
    if (e.target.closest('[data-add]')) {
      added(prod, state.qty, state.v);
      state.qty = 1;
      return;
    }
    if (e.target.closest('[data-save]')) {
      wishlist.toggle(prod.id);
      return renderBuy();
    }
    if (e.target.closest('[data-share]')) {
      const url = `${location.origin}/p/${encodeURIComponent(prod.id)}${state.v ? `?size=${encodeURIComponent(state.v)}` : ''}`;
      try {
        if (navigator.share) await navigator.share({ title: `${prod.name} · Raza Perfume`, url });
        else {
          await navigator.clipboard.writeText(url);
          e.target.closest('[data-share]').lastChild.textContent = ' Link copied';
        }
      } catch { /* dismissed */ }
    }
  });
  info.addEventListener('keydown', (e) => {
    const group = e.target.closest('[role="radiogroup"]');
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!group || !d) return;
    e.preventDefault();
    const radios = $$('[role="radio"]', group);
    const i = radios.indexOf(group.querySelector('[aria-checked="true"]'));
    radios[(i + d + radios.length) % radios.length].click();
  });
  cart.subscribe(renderBuy);

  /* ------------------------------------------------ phone buy bar */
  const bar = $('[data-buybar]');
  function renderBar() {
    const s = size();
    const unit = s ? s.price : prod.price;
    bar.innerHTML = `<div><b>${esc(prod.name)}</b><span>${s ? `${esc(s.label)} · ` : ''}${unit != null ? fmt(unit) : 'Price on request'}</span></div><button class="btn btn--solid" type="button" data-bar-add ${soldOut(prod) ? 'disabled' : ''}><span class="btn__label">${soldOut(prod) ? 'Sold out' : 'Add'}</span></button>`;
  }
  bar.addEventListener('click', (e) => {
    if (e.target.closest('[data-bar-add]')) added(prod, 1, state.v);
  });
  // shown once the page's own Add button has scrolled up out of view (checked
  // on scroll, so a fast fling past it counts too)
  const anchor = $('[data-buy-anchor]');
  let ticking = false;
  const place = () => {
    ticking = false;
    const show = anchor.getBoundingClientRect().bottom < 0;
    if (show === bar.classList.contains('is-on')) return;
    bar.classList.toggle('is-on', show);
    bar.setAttribute('aria-hidden', !show);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) requestAnimationFrame(place);
    ticking = true;
  }, { passive: true });
  renderBuy();

  /* ---------------------------------------------------- films + related */
  if (reels.length) {
    $('[data-films-wrap]').hidden = false;
    $('[data-films]').innerHTML = reels.map((f) => `<a class="pp__film" href="/blogs?v=${encodeURIComponent(f.slug)}"><img src="${esc(f.poster)}" alt="" loading="lazy" /><span>▶ ${esc(f.title)}</span></a>`).join('');
  }
  const siblings = catalog.list().filter((x) => x.category === prod.category && x.id !== prod.id);
  const at = siblings.findIndex((x) => x.number > prod.number);
  const related = [...siblings.slice(Math.max(0, at)), ...siblings.slice(0, Math.max(0, at))]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(photosOf(b).length > 0) - Number(photosOf(a).length > 0))
    .slice(0, 8);
  if (related.length) {
    $('[data-related-wrap]').hidden = false;
    $('[data-related-title]').textContent = `More from the ${collectionOf(prod).toLowerCase()}`;
    $('[data-related]').innerHTML = related.map((x) => `<a class="pp__card" href="/p/${encodeURIComponent(x.id)}"><span class="pp__card-img"><img src="${esc(imageFor(x))}" alt="" loading="lazy" /></span><b>${esc(x.name)}</b><span>${x.price != null ? `From ${fmt(x.price)}` : 'Price on request'}</span></a>`).join('');
  }
}

function seo(prod, first) {
  const collection = collectionOf(prod);
  const title = `${prod.name} — ${collection} | Raza Perfume`;
  const sizes = hasSizes(prod) ? `Perfume ${prod.variants.filter((v) => v.type === 'perfume').map((v) => v.ml).join('/')} ml and attar ${prod.variants.filter((v) => v.type === 'attar').map((v) => v.ml).join('/')} ml. ` : '';
  const text = prod.description || `${prod.name} from the ${collection.toLowerCase()} of Raza Perfume NX2, Kalyan. ${sizes}Order on WhatsApp.`;
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', text);
  const url = `${location.origin}/p/${encodeURIComponent(prod.id)}`;
  document.querySelector('[data-canonical]')?.setAttribute('href', url);
  const prices = (hasSizes(prod) ? prod.variants.map((v) => v.price) : [prod.price]).filter((n) => n != null);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: prod.name,
    description: text,
    image: new URL(first.src || first.thumb, location.origin).href,
    brand: { '@type': 'Brand', name: 'Raza Perfume' },
    sku: prod.id,
    category: collection,
    ...(prices.length ? {
      offers: {
        '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices),
        offerCount: prices.length, availability: soldOut(prod) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url,
      },
    } : {}),
  };
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld);
  document.head.append(s);
}
