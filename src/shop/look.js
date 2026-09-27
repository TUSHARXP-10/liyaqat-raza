// How each product looks: liquid colour and image. Shared by the shop UI and
// the product-render tool so thumbnails and renders always agree.
import PHOTOS from './photos.json' with { type: 'json' };

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

// Real photos first (Supabase image_url, then "product image/" via
// `npm run import:photos`), otherwise the studio render.
// size: 'sm' for cards and thumbnails, 'lg' for quick view.
// root-absolute, so nested pages (/p/<fragrance>) find the files too
export const assetBase = () => {
  const b = import.meta.env?.BASE_URL ?? '/';
  return b === './' ? '/' : b;
};
const base = assetBase;

// A photo may be of one kind ("for": 'attar' | 'perfume'). The general photos
// ("Perfume bottles.jpg", "Attar bottles.jpg": Raza bottles with no fragrance
// name) stand in for a fragrance with none of that kind, so every fragrance
// shows a real photo. Each fragrance leads with a different one so
// neighbouring cards vary, and shows at most GENERAL_SHOWN of them. They carry
// `general: true`, so quick view and the product page can say so.
const GENERAL = { attar: PHOTOS['*attar'] || [], perfume: PHOTOS['*perfume'] || [] };
const GENERAL_SHOWN = 3;
const GENERAL_ALT = { perfume: 'shown in a Raza house bottle', attar: 'Raza attar' };
const CATEGORY_SHIFT = { luxury: 0, premium: 2, regular: 4 };
const general = (p, kind) => {
  // the house signatures keep their own studio bottle (the 3D bottle of the Collection chapter)
  if (p.category === 'house') return [];
  const list = GENERAL[kind] || [];
  // round-robin by catalogue number, so consecutive fragrances never share one
  const n = Number.isFinite(p.number) ? p.number + (CATEGORY_SHIFT[p.category] || 0) : hash(p.id);
  const at = list.length ? n % list.length : 0;
  return [...list.slice(at), ...list.slice(0, at)]
    .slice(0, GENERAL_SHOWN)
    .map((ph) => ({ ...ph, alt: `${p.name}, ${GENERAL_ALT[kind]}`, general: true }));
};

// The photos for what the shopper has picked (kind: 'perfume' | 'attar';
// nothing picked counts as perfume):
//   Attar   → the fragrance's attar photos, else the general attar photos,
//             then its notes cards (else its other photos)
//   Perfume → its perfume photos and untagged photos, else the general
//             perfume photos, else none (the studio render: house signatures)
export function photosOf(p, kind = null) {
  const all = [
    ...(p.image ? [{ sm: p.image, lg: p.image, alt: p.name, url: true }] : []),
    ...(p.images || []),
  ];
  const plain = all.filter((ph) => !ph.for);
  if (kind === 'attar') {
    const lead = all.filter((ph) => ph.for === 'attar');
    const shots = lead.length ? lead : general(p, 'attar');
    return shots.length ? [...shots, ...plain.filter((ph) => ph.kind === 'card')] : plain;
  }
  const mine = [...all.filter((ph) => ph.for === 'perfume'), ...plain];
  return mine.some((ph) => ph.kind !== 'card') ? mine : [...general(p, 'perfume'), ...mine];
}
export const hasPhoto = (p, kind = null) => photosOf(p, kind).length > 0;
// size: 'lg' (large views), 'sm' (cards), 'xs' (thumbnails; photos uploaded
// in the admin panel have no xs, so they fall back to sm)
export function imageFor(p, { size = 'sm', index = 0, kind = null } = {}) {
  const photo = photosOf(p, kind)[index];
  const file = photo && (photo[size] || photo.sm || photo.lg);
  if (file) return photo.url ? file : `${base()}${file}`;
  return `${base()}media/products/${p.id}.webp`;
}

// Text printed on the rendered bottle label (never another house's name).
export function labelFor(p) {
  if (p.category === 'house') return { key: p.id, line: 'PREMIUM LUXURY', title: p.name.toUpperCase(), footer: 'EAU DE PARFUM' };
  const line = { regular: 'REGULAR COLLECTION', premium: 'PREMIUM COLLECTION', luxury: 'LUXURY COLLECTION' }[p.category];
  return { key: p.id, line, title: `Nº ${String(p.number).padStart(2, '0')}`, footer: 'SINCE 1986' };
}
