import { PRODUCTS, SIGNATURES } from './products.js';

// Live product list. Starts from the bundled catalogue and is refreshed from
// Supabase when configured (prices, new products, hidden products).

const byId = new Map([...PRODUCTS, ...SIGNATURES].map((p) => [p.id, { ...p, active: true }]));
const ORDER = { luxury: 0, premium: 1, regular: 2, house: 3 };

export const catalog = {
  get: (id) => byId.get(id),

  // shop grid: most exclusive first
  list: () =>
    [...byId.values()]
      .filter((p) => p.active && p.category !== 'house')
      .sort((a, b) => ORDER[a.category] - ORDER[b.category] || a.number - b.number),

  merge(rows) {
    const live = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      // Supabase is the source of truth for price/size; blank photo or
      // description fields keep the bundled render and copy
      const fields = Object.fromEntries(Object.entries(r).filter(([k, v]) => v != null || k === 'price' || k === 'sizeMl' || k === 'stock'));
      byId.set(r.id, { ...byId.get(r.id), ...fields, active: true });
    }
    for (const p of byId.values()) if (!live.has(p.id)) p.active = false;
  },
};
