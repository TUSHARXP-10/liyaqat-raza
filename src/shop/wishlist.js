// Saved fragrances, remembered in this browser (a convenience, not an account).

const KEY = 'raza-wishlist-v1';
const subscribers = new Set();

let ids = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(saved)) ids = new Set(saved.filter((x) => typeof x === 'string'));
} catch { /* storage unavailable */ }

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch { /* storage unavailable: still works for this visit */ }
  subscribers.forEach((fn) => fn(ids));
}

export const wishlist = {
  has: (id) => ids.has(id),
  get size() {
    return ids.size;
  },
  // returns true if the product is now saved
  toggle(id) {
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    commit();
    return ids.has(id);
  },
  prune(isValid) {
    const before = ids.size;
    ids = new Set([...ids].filter(isValid));
    if (ids.size !== before) commit();
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
};
