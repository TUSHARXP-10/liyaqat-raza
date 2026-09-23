// How each product looks: liquid colour and image. Shared by the shop UI and
// the product-render tool so thumbnails and renders always agree.

export const TINTS = {
  regular: ['#d9a441', '#e7c47d', '#c98a2e', '#b8621c', '#efd9a6', '#a9b98f', '#caa0a0', '#9fb9cf'],
  premium: ['#8a3b12', '#6b2410', '#b0641f', '#3e1c0e', '#7d4a1f', '#a2512c'],
  luxury: ['#2a130a', '#4a230d', '#5c3310', '#1d0f08', '#6b3a14'],
  house: ['#b0640f', '#1b0c05', '#efe6d4'],
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function tintFor(p) {
  const tints = TINTS[p.category] || TINTS.regular;
  return p.category === 'house' ? tints[(p.number - 1) % tints.length] : tints[hash(p.id) % tints.length];
}

// A real photo (Supabase image_url) wins; otherwise the studio render.
export function imageFor(p) {
  if (p.image) return p.image;
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}media/products/${p.id}.webp`;
}

// Text printed on the rendered bottle label (never another house's name).
export function labelFor(p) {
  if (p.category === 'house') return { key: p.id, line: 'PREMIUM LUXURY', title: p.name.toUpperCase(), footer: 'EAU DE PARFUM' };
  const line = { regular: 'REGULAR COLLECTION', premium: 'PREMIUM COLLECTION', luxury: 'LUXURY COLLECTION' }[p.category];
  return { key: p.id, line, title: `Nº ${String(p.number).padStart(2, '0')}`, footer: 'SINCE 1986' };
}
