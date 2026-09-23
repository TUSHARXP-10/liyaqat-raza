import { catalog } from './catalog.js';

// The bag, remembered in this browser only (a convenience, not an order).

const KEY = 'raza-bag-v1';
const MAX = 99;
const subscribers = new Set();

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((i) => typeof i?.id === 'string' && catalog.get(i.id) && Number.isInteger(i.qty) && i.qty > 0)
      .map((i) => ({ id: i.id, qty: Math.min(i.qty, MAX) }));
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
  add(id, qty = 1) {
    const found = items.find((i) => i.id === id);
    commit(found
      ? items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX, i.qty + qty) } : i))
      : [...items, { id, qty }]);
  },
  set(id, qty) {
    commit(qty <= 0 ? items.filter((i) => i.id !== id) : items.map((i) => (i.id === id ? { ...i, qty: Math.min(MAX, qty) } : i)));
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
  // re-validate after the live catalogue arrives (drops removed products)
  revalidate() {
    commit(items.filter((i) => catalog.get(i.id)?.active));
  },
};
