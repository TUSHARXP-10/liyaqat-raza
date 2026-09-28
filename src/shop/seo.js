// What search engines read about a fragrance: its page title, description and
// structured data. Shared by the build (prerendered /p/<id> pages) and the
// browser (fragrances added later in the admin panel), so both say the same.
import { seoName, originLine } from './origin.js';

export const SITE = 'https://www.razaperfume.com';

// the landing page of each collection (scripts/seo-pages.mjs)
export const COLLECTION_PAGE = {
  regular: { path: '/regular', label: 'Regular collection' },
  premium: { path: '/premium', label: 'Premium collection' },
  luxury: { path: '/luxury', label: 'Luxury collection' },
};
export const collectionLabel = (p) => COLLECTION_PAGE[p.category]?.label || 'House signature';

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const priced = (p, type) => (p.variants?.length ? p.variants : [{ type: null, price: p.price }])
  .filter((v) => (!type || v.type === type) && v.price != null)
  .map((v) => Number(v.price));
export const fromPrice = (p, type = null) => {
  const all = priced(p, type);
  return all.length ? Math.min(...all) : null;
};
const kindsOf = (p) => new Set((p.variants || []).map((v) => v.type).filter(Boolean));

// "Perfume & Attar", "Attar", "Perfume"
export function kindWords(p) {
  const k = kindsOf(p);
  if (k.has('perfume') && k.has('attar')) return 'Perfume & Attar';
  if (k.has('attar')) return 'Attar';
  return 'Perfume';
}

// ~60 characters, the fragrance first: "Inspired by Dior Sauvage · Perfume & Attar | Raza Perfume"
export const productTitle = (p) => `${seoName(p)} · ${kindWords(p)} | Raza Perfume`;

// ~155 characters: what it is, what it costs, where it's from
export function productDescription(p) {
  const perfume = fromPrice(p, 'perfume');
  const attar = fromPrice(p, 'attar');
  const any = fromPrice(p);
  const prices = [perfume != null && `perfume from ${inr(perfume)}`, attar != null && `attar from ${inr(attar)}`].filter(Boolean);
  const cost = prices.length ? `${prices.join(', ')}. ` : any != null ? `From ${inr(any)}. ` : '';
  const lead = p.inspired
    ? `Raza Perfume’s own impression inspired by ${p.name}, not the original.`
    : `${p.name}, a Raza Perfume original.`;
  return `${lead} ${cost.charAt(0).toUpperCase()}${cost.slice(1)}Raza Perfume, Kalyan, since 1986. Order on WhatsApp.`;
}

// schema.org Product: one offer per size, so Google can show the price
export function productLd(p, { image, soldOut = false } = {}) {
  const url = `${SITE}/p/${encodeURIComponent(p.id)}`;
  const availability = soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock';
  const sizes = (p.variants || []).filter((v) => v.price != null);
  const offer = (price, extra = {}) => ({
    '@type': 'Offer', price: Number(price), priceCurrency: 'INR', availability,
    itemCondition: 'https://schema.org/NewCondition', seller: { '@id': `${SITE}/#store` }, ...extra,
  });
  const offers = sizes.length
    ? sizes.map((v) => offer(v.price, { name: `${v.type === 'attar' ? 'Attar' : 'Perfume'} · ${v.ml} ml`, url: `${url}?size=${encodeURIComponent(v.id || `${v.type}-${v.ml}ml`)}` }))
    : p.price != null ? [offer(p.price, { url })] : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: seoName(p),
    description: `${originLine(p)} ${p.description || ''}`.trim(),
    url,
    ...(image ? { image } : {}),
    brand: { '@type': 'Brand', name: 'Raza Perfume' },
    sku: p.id,
    category: `Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne`,
    ...(offers.length ? { offers } : {}),
  };
}

export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(path ? { item: `${SITE}${path}` } : {}) })),
  };
}
