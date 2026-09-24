import { catalog } from './catalog.js';

// The bag, remembered in this browser only (a convenience, not an order).

const KEY = 'raza-bag-v1';
const MAX = 99;
const subscribers = new Set();

// most a customer can take of one product: stock when tracked, else 99
export const limitFor = (id) => {
  const stock = catalog.get(id)?.stock;
  return stock == null ? MAX : Math.max(0, Math.min(MAX, stock));
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((i) => typeof i?.id === 'string' && catalog.get(i.id) && Number.isInteger(i.qty) && i.qty > 0)
      .map((i) => ({ id: i.id, qty: Math.min(i.qty, limitFor(i.id)) }))
      .filter((i) => i.qty > 0);
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
  qtyOf: (id) => items.find((i) => i.id === id)?.qty || 0,
  // returns how many were actually added (stock may cap it)
  add(id, qty = 1) {
    const have = cart.qtyOf(id);
    const next = Math.min(limitFor(id), have + qty);
    if (next <= have) return 0;
    commit(have
      ? items.map((i) => (i.id === id ? { ...i, qty: next } : i))
      : [...items, { id, qty: next }]);
    return next - have;
  },
  set(id, qty) {
    const q = Math.min(limitFor(id), qty);
    commit(q <= 0 ? items.filter((i) => i.id !== id) : items.map((i) => (i.id === id ? { ...i, qty: q } : i)));
  },
  clear: () => commit([]),
  // subtotal of priced lines; count of units still "price on request"
  totals() {
    let subtotal = 0;
    let unpriced = 0;
    for (const i of items) {
      const p = catalog.get(i.id);
      if (p?.price != null) subtotal += p.price * i.qty;
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
    commit(items
      .filter((i) => catalog.get(i.id)?.active)
      .map((i) => ({ ...i, qty: Math.min(i.qty, limitFor(i.id)) }))
      .filter((i) => i.qty > 0));
  },
};
