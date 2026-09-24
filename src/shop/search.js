import { CATEGORY_LABEL } from './products.js';

// Forgiving product search: every word of the query must match, either
// exactly, as the start of a word, as a number ("16", "no 16"), or within a
// typo or two ("savage" → Sauvage, "levender" → Lavender). Results carry a
// relevance score so the best matches come first.

export const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Damerau–Levenshtein (optimal string alignment), early exit above `max`
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

const allowed = (len) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

const index = new WeakMap();
function haystack(p) {
  let h = index.get(p);
  if (!h) {
    // every fragrance is a perfume, so only other kinds (attar) help a search
    const kinds = [...new Set((p.variants || []).map((v) => v.type).filter((t) => t && t !== 'perfume'))].join(' ');
    const words = norm(`${p.name} ${p.sheetName || ''} ${CATEGORY_LABEL[p.category] || ''} ${p.inspired ? 'inspired' : 'raza original'} ${kinds}`);
    h = { text: ` ${words} `, words: [...new Set(words.split(' '))], name: norm(p.name) };
    index.set(p, h);
  }
  return h;
}

// score > 0 = match (higher is better); 0 = no match
export function score(p, query) {
  const tokens = norm(query).split(' ').filter(Boolean).filter((t) => t !== 'no');
  if (!tokens.length) return 1;
  const h = haystack(p);
  let total = 0;
  for (const t of tokens) {
    if (/^\d+$/.test(t) && Number(t) === p.number) { total += 5; continue; }
    if (h.text.includes(` ${t}`)) { total += h.name.startsWith(t) ? 6 : 4; continue; }
    if (h.text.includes(t)) { total += 3; continue; }
    const max = allowed(t.length);
    if (max && h.words.some((w) => distance(t, w, max) <= max || (w.length > t.length && distance(t, w.slice(0, t.length), max) <= max))) {
      total += 1;
      continue;
    }
    return 0;
  }
  return total;
}

// "did you mean": the closest product names to a query that found nothing
export function suggest(query, products, limit = 3) {
  const q = norm(query).replace(/ /g, '');
  if (q.length < 3) return [];
  const max = Math.max(2, Math.round(q.length * 0.4));
  return products
    .map((p) => {
      const n = norm(p.name).replace(/ /g, '');
      return { p, d: Math.min(distance(q, n, max), distance(q, n.slice(0, q.length), max) + 1) };
    })
    .filter((x) => x.d <= max)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

// wraps the first place the query text appears in a name with <mark>
export function highlight(name, query, esc) {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter((t) => t.length > 1).sort((a, b) => b.length - a.length);
  const lower = name.toLowerCase();
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i >= 0) return `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + t.length))}</mark>${esc(name.slice(i + t.length))}`;
  }
  return esc(name);
}
