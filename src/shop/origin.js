// What every fragrance is, said the same way everywhere (cards, quick view,
// product pages, the bag, page titles and search results):
//   Raza Original  a fragrance created by the House of Raza
//   Inspired       Raza Perfume's own impression of another house's scent:
//                  never the original product, never affiliated with it.
// The flag is `inspired` on each product (products.js, or the admin panel).

export const originLabel = (p) => (p.inspired ? 'Inspired' : 'Raza Original');

// the full statement, shown in quick view and on the product page
export const originLine = (p) => (p.inspired
  ? `Inspired by ${p.name}: Raza Perfume’s own impression of the scent, made by Raza. It is not the original product, and Raza Perfume is not affiliated with or endorsed by its brand.`
  : 'A Raza Perfume original, created by the House of Raza.');

// the name as page titles and search engines show it
export const seoName = (p) => (p.inspired ? `Inspired by ${p.name}` : p.name);

// the short description search engines and link previews show
export const seoOrigin = (p) => (p.inspired
  ? `Raza Perfume’s own impression inspired by ${p.name} (not the original; not affiliated with its brand)`
  : `${p.name}, a Raza Perfume original`);
