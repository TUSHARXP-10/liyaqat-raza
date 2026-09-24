import { catalog } from './catalog.js';
import { hasSizes, variantOf, unitPrice } from './products.js';

// The bag, remembered in this browser only (a convenience, not an order).
// A line is one product in one size: { id, v, qty }, where v is the size id
// ('perfume-30ml') or null for a product sold in one size.

const KEY = 'raza-bag-v1';
const MAX = 99;
const subscribers = new Set();

// most a customer can take of one product, all sizes together: stock when tracked, else 99
export const limitFor = (id) => {
  const stock = catalog.get(id)?.stock;
  return stock == null ? MAX : Math.max(0, Math.min(MAX, stock));
};

const same = (i, id, v) => i.id === id && (i.v ?? null) === (v ?? null);

// drops lines whose product (or size) is gone, and caps each product at its limit
function tidy(lines) {
  const used = new Map();
  return lines
    .filter((i) => {
      const p = catalog.get(i.id);
      if (!p || p.active === false) return false;
      return hasSizes(p) ? Boolean(variantOf(p, i.v)) : i.v == null;
    })
    .map((i) => {
      const qty = Math.min(i.qty, limitFor(i.id) - (used.get(i.id) || 0));
      used.set(i.id, (used.get(i.id) || 0) + Math.max(0, qty));
      return { ...i, qty };
    })
    .filter((i) => i.qty > 0);
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return tidy(saved
      .filter((i) => typeof i?.id === 'string' && Number.isInteger(i.qty) && i.qty > 0)
      .map((i) => ({ id: i.id, v: typeof i.v === 'string' ? i.v : null, qty: i.qty })));
  } catch {
    return [];
  }
}

let items = read();

function commit(next) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / storage blocked: the bag still works for this visit */
  }
  subscribers.forEach((fn) => fn(items));
}

export const cart = {
  get items() {
    return items;
  },
  count: () => items.reduce((n, i) => n + i.qty, 0),
  // qtyOf(id): the product in all sizes · qtyOf(id, v): one size (null = sold in one size)
  qtyOf: (id, v) => items.filter((i) => (v === undefined ? i.id === id : same(i, id, v))).reduce((n, i) => n + i.qty, 0),
  linesOf: (id) => items.filter((i) => i.id === id),
  // returns how many were actually added (stock may cap it)
  add(id, qty = 1, v = null) {
    const got = Math.max(0, Math.min(qty, limitFor(id) - cart.qtyOf(id)));
    if (!got) return 0;
    commit(cart.qtyOf(id, v)
      ? items.map((i) => (same(i, id, v) ? { ...i, qty: i.qty + got } : i))
      : [...items, { id, v, qty: got }]);
    return got;
  },
  set(id, qty, v = null) {
    const q = Math.min(limitFor(id) - (cart.qtyOf(id) - cart.qtyOf(id, v)), qty);
    commit(q <= 0 ? items.filter((i) => !same(i, id, v)) : items.map((i) => (same(i, id, v) ? { ...i, qty: q } : i)));
  },
  clear: () => commit([]),
  // subtotal of priced lines; count of units still "price on request"
  totals() {
    let subtotal = 0;
    let unpriced = 0;
    for (const i of items) {
      const price = unitPrice(catalog.get(i.id), i.v);
      if (price != null) subtotal += price * i.qty;
      else unpriced += i.qty;
    }
    return { subtotal, unpriced };
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  // re-validate after the live catalogue arrives (drops removed / sold-out lines)
  revalidate() {
    commit(tidy(items));
  },
};
