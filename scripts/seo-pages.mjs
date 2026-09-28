// Pages for search engines, built with the site (vite.config.js). They are
// plain HTML: fast to load and fully readable without JavaScript.
//   /attar /perfumes /oud          every fragrance of that kind
//   /luxury /premium /regular      each collection
//   /guides, /guides/<slug>        guides/*.md
//   /p/<id>                        the fragrance's details, prices and structured data in the HTML
//   the home page's structured data (the shop, for Google Search and Maps)
import { readFileSync, readdirSync } from 'node:fs';
import { markdownToHtml } from './license-page.mjs';
import { BUSINESS, SHOP } from '../src/content.js';
import { DEFAULTS } from '../src/cms/fields.js';
import { seoName, originLabel, originLine } from '../src/shop/origin.js';
import { SITE, COLLECTION_PAGE, collectionLabel, inr, fromPrice, productTitle, productDescription, productLd, breadcrumbLd } from '../src/shop/seo.js';

const ROOT = new URL('../', import.meta.url);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ld = (obj, tag = '') => `<script type="application/ld+json"${tag ? ` data-ld="${tag}"` : ''}>${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const pad = (n) => String(n).padStart(2, '0');
const COLLECTIONS = ['luxury', 'premium', 'regular'];
const SHIPPING = DEFAULTS['shop.shipping'];
const waLink = (text) => `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------ the shop */

export function addressLine() {
  const b = BUSINESS;
  const place = [b.locality, [b.region, b.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [b.street, place].filter(Boolean).join(', ');
}

const DAYS = { Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su' };

// schema.org: the website (its name in Google results) and the shop
export function siteLd(products) {
  const b = BUSINESS;
  const prices = products.map((p) => fromPrice(p)).filter((n) => n != null);
  const top = Math.max(...products.flatMap((p) => (p.variants || []).map((v) => Number(v.price) || 0)));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        url: `${SITE}/`,
        name: b.name,
        alternateName: b.alternateNames,
        inLanguage: 'en-IN',
        publisher: { '@id': `${SITE}/#store` },
      },
      {
        '@type': 'Store',
        '@id': `${SITE}/#store`,
        name: b.name,
        alternateName: [...b.alternateNames, 'رضا'],
        description: `Attars and perfumes from Raza Perfume, Kalyan, since ${b.since}: ${products.length} fragrances, each as attar (6 and 12 ml) and perfume (30, 50 and 100 ml). Orders on WhatsApp, delivery across India.`,
        url: `${SITE}/`,
        image: [`${SITE}/og.jpg`],
        logo: `${SITE}/icons/icon-512.png`,
        foundingDate: String(b.since),
        founder: [
          { '@type': 'Person', name: 'Yasinali Sayed' },
          { '@type': 'Person', name: 'Liyaqat Sayed', jobTitle: 'Founder & Owner' },
          { '@type': 'Person', name: 'Amjad Ali Sayed', jobTitle: 'Co-Founder & Partner' },
        ],
        telephone: '+91-90295-04320',
        address: {
          '@type': 'PostalAddress',
          ...(b.street ? { streetAddress: b.street } : {}),
          addressLocality: b.locality,
          addressRegion: b.region,
          ...(b.postalCode ? { postalCode: b.postalCode } : {}),
          addressCountry: b.country,
        },
        ...(b.geo ? { geo: { '@type': 'GeoCoordinates', latitude: b.geo.lat, longitude: b.geo.lng } } : {}),
        ...(b.mapsUrl ? { hasMap: b.mapsUrl } : {}),
        ...(b.hours.length ? {
          openingHoursSpecification: b.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
          openingHours: b.hours.map((h) => `${h.days.map((d) => DAYS[d] || d).join(',')} ${h.opens}-${h.closes}`),
        } : {}),
        priceRange: `${inr(Math.min(...prices))} – ${inr(top)}`,
        currenciesAccepted: 'INR',
        areaServed: [{ '@type': 'City', name: 'Kalyan' }, { '@type': 'State', name: 'Maharashtra' }, { '@type': 'Country', name: 'India' }],
        knowsAbout: ['Attar', 'Perfume', 'Oud', 'Perfume oil', 'Kannauj attar'],
        sameAs: [SHOP.instagram],
        contactPoint: [
          { '@type': 'ContactPoint', contactType: 'sales', telephone: '+91-89760-35333', areaServed: 'IN', availableLanguage: ['English', 'Hindi', 'Marathi', 'Urdu'] },
          { '@type': 'ContactPoint', contactType: 'customer service', telephone: '+91-90295-04320', areaServed: 'IN' },
        ],
      },
    ],
  };
}
export const siteLdTag = (products) => ld(siteLd(products));

/* ------------------------------------------------------------ prices */

const sizeList = (p, type) => (p.variants || []).filter((v) => v.type === type && v.price != null);
// one row per collection: the price of each size (the same for every fragrance in it)
function priceRows(products, type) {
  return COLLECTIONS.map((c) => {
    const inIt = products.filter((p) => p.category === c);
    if (!inIt.length) return null;
    const sizes = [...new Set(inIt.flatMap((p) => sizeList(p, type).map((v) => v.ml)))].sort((a, b) => a - b);
    const cells = sizes.map((ml) => {
      const at = inIt.flatMap((p) => sizeList(p, type).filter((v) => v.ml === ml).map((v) => Number(v.price)));
      const lo = Math.min(...at);
      const hi = Math.max(...at);
      return { ml, text: lo === hi ? inr(lo) : `${inr(lo)}–${inr(hi)}` };
    });
    return { c, label: COLLECTION_PAGE[c].label, path: COLLECTION_PAGE[c].path, cells };
  }).filter(Boolean);
}
function priceTableHtml(products, types = ['attar', 'perfume']) {
  const blocks = types.map((type) => ({ type, rows: priceRows(products, type) })).filter((b) => b.rows.some((r) => r.cells.length));
  const head = blocks.map((b) => `<th scope="col">${b.type === 'attar' ? 'Attar' : 'Perfume'} ${esc([...new Set(b.rows.flatMap((r) => r.cells.map((x) => x.ml)))].join(' / '))} ml</th>`).join('');
  const body = COLLECTIONS.map((c) => {
    const cells = blocks.map((b) => b.rows.find((r) => r.c === c));
    if (!cells.some(Boolean)) return '';
    const row = cells.find(Boolean);
    return `<tr><th scope="row"><a href="${row.path}">${esc(row.label)}</a></th>${cells.map((r) => `<td>${r ? esc(r.cells.map((x) => x.text).join(' / ')) : '—'}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="table"><table><thead><tr><th scope="col">Collection</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
// the same table in Markdown, for {{price-table}} in the guides
function priceTableMd(products) {
  const at = priceRows(products, 'attar');
  const pf = priceRows(products, 'perfume');
  const mls = (rows) => [...new Set(rows.flatMap((r) => r.cells.map((x) => x.ml)))].join(' / ');
  return [`| Collection | Attar ${mls(at)} ml | Perfume ${mls(pf)} ml |`, '|---|---|---|',
    ...COLLECTIONS.map((c) => {
      const a = at.find((r) => r.c === c);
      const p = pf.find((r) => r.c === c);
      if (!a && !p) return null;
      return `| [${(a || p).label.replace(' collection', '')}](${(a || p).path}) | ${a ? a.cells.map((x) => x.text).join(' / ') : '—'} | ${p ? p.cells.map((x) => x.text).join(' / ') : '—'} |`;
    }).filter(Boolean)].join('\n');
}

/* ------------------------------------------------------------ guides */

function readGuides() {
  const dir = new URL('guides/', ROOT);
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\r\n/g, '\n');
    const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = Object.fromEntries((m ? m[1] : '').split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2].trim()]));
    return { slug: f.replace(/\.md$/, ''), path: `/guides/${f.replace(/\.md$/, '')}`, ...meta, related: (meta.related || '').split(',').map((s) => s.trim()).filter(Boolean), body: m ? m[2] : src };
  }).sort((a, b) => (a.order || a.title).localeCompare(b.order || b.title));
}

/* ------------------------------------------------------------ landing pages */

const has = (p, word) => new RegExp(`\\b${word}\\b`, 'i').test(p.name);
const KIND_PAGES = {
  attar: {
    kind: 'attar',
    pick: () => true,
    title: (n, all) => `Attar Shop in Kalyan · ${n} Attars from ${inr(fromMin(all, 'attar'))} | Raza Perfume`,
    description: (n, all) => `${n} attars (perfume oils) from Raza Perfume, Kalyan, since 1986: 6 ml and 12 ml, from ${inr(fromMin(all, 'attar'))}. Oud, rose, musk and inspired fragrances. Order on WhatsApp, delivery across India.`,
    h1: 'Attars by Raza Perfume',
    lead: (n, all) => `Every Raza fragrance as perfume oil: ${n} attars in 6 ml and 12 ml bottles, from ${inr(fromMin(all, 'attar'))}.`,
    intro: () => `
<p>Attar is perfume in its oldest form: a concentrated <strong>perfume oil</strong>, dabbed on the skin rather than sprayed. It sits close to the skin, feels warm and personal, and a small bottle goes a long way. At Raza Perfume, every fragrance in the house is available as attar, alongside the spray perfume.</p>
<p>Raza has made fragrance in Kalyan since 1986. Our founder, Yasinali Sayed, learned the craft in Kannauj, India’s perfume capital, where attar has been distilled the same way for centuries. <a href="/guides/kannauj-attar">Read how Kannauj makes attar</a>.</p>`,
    types: ['attar'],
    sections: [
      ['How to wear attar', `<p>Use one drop on each pulse point (the inside of the wrists, behind the ears, the base of the throat) and let it settle rather than rubbing it in. Keep deeper ouds and ambers for the evening and cooler months. <a href="/guides/how-to-apply-attar">More on applying attar</a>.</p>`],
      ['Attar or perfume?', `<p>Attar projects less and stays close to you; a perfume spray reaches further and opens brighter. Many people wear both, a drop of attar under a spray of the same fragrance. <a href="/guides/attar-vs-perfume">Attar vs perfume, explained</a>.</p>`],
    ],
    group: true,
  },
  perfumes: {
    kind: 'perfume',
    pick: () => true,
    title: (n, all) => `Inspired Perfumes from ${inr(fromMin(all, 'perfume'))} · 30, 50 & 100 ml | Raza Perfume`,
    description: (n, all) => `${n} perfumes by Raza Perfume, Kalyan, since 1986: our own impressions of well-loved fragrances in 30, 50 and 100 ml, from ${inr(fromMin(all, 'perfume'))}. Order on WhatsApp, delivery across India.`,
    h1: 'Perfumes by Raza Perfume',
    lead: (n, all) => `${n} fragrances as spray perfume, in 30, 50 and 100 ml, from ${inr(fromMin(all, 'perfume'))}.`,
    intro: () => `
<p>Every Raza perfume is <strong>Raza’s own impression</strong> of a well-loved fragrance, from fresh everyday favourites to rich Arabian ouds, made by Raza and sold under the Raza name. Each one also comes as an attar.</p>
<p class="note">Names such as “Inspired by Dior Sauvage” describe the scent profile only. Our fragrances are not the original products, and Raza Perfume is not affiliated with or endorsed by the brands referenced. <a href="/guides/inspired-perfumes">What “Inspired” means</a>.</p>`,
    types: ['perfume'],
    sections: [
      ['Make it last', `<p>Spray after a bath on moisturised skin, aim for the neck and the inside of the wrists, and don’t rub. Woody, amber and oud fragrances last longest; fresh citrus fades faster in the heat. <a href="/guides/make-perfume-last-longer">Ten ways to make perfume last longer</a>.</p>`],
    ],
    group: true,
  },
  oud: {
    kind: 'perfume',
    pick: (p) => has(p, 'oud'),
    title: (n) => `Oud Perfume & Oud Attar · ${n} Oud Fragrances | Raza Perfume`,
    description: (n, all) => `${n} oud fragrances from Raza Perfume, Kalyan: woody, smoky, rich. Each as attar (6 and 12 ml) and perfume (30, 50 and 100 ml), from ${inr(fromMin(all))}. Order on WhatsApp.`,
    h1: 'Oud perfumes and attars',
    lead: (n) => `${n} fragrances built around the character of oud, each as attar and as perfume.`,
    intro: () => `
<p><strong>Oud</strong>, from the resin-rich heartwood of the agarwood tree, is the heart of Arabian perfumery: woody, smoky, deep and long-lasting. These are the Raza fragrances built around its character, from rich luxury ouds to softer blends with rose, lavender, vanilla and caramel.</p>
<p><a href="/guides/what-is-oud">What is oud? A short guide</a>.</p>`,
    types: ['attar', 'perfume'],
    sections: [
      ['How to wear oud', `<p>Start small (one drop of attar or one or two sprays), give it twenty minutes to settle, and save it for evenings and the cooler months. A drop of oud attar under a rose or amber perfume adds depth.</p>`],
    ],
    group: true,
  },
};
const COLLECTION_COPY = {
  luxury: {
    title: 'Luxury Perfumes & Attars: Oud, Amber & Arabian | Raza Perfume',
    h1: 'Luxury perfumes and attars',
    intro: 'Our richest fragrances: ouds, ambers and Arabian favourites alongside celebrated designer profiles, each in Raza’s own interpretation.',
  },
  premium: {
    title: (all) => `Premium Perfumes & Attars from ${inr(fromMin(all))} | Raza Perfume Kalyan`,
    h1: 'Premium perfumes and attars',
    intro: 'Deep, characterful fragrances: gourmand vanillas and chocolate, Arabian favourites, sandalwood and musk classics, and much-loved designer profiles, each in Raza’s own interpretation.',
  },
  regular: {
    title: (all) => `Everyday Perfumes & Attars from ${inr(fromMin(all))} | Raza Perfume Kalyan`,
    h1: 'Everyday perfumes and attars',
    intro: 'Everyday favourites at everyday prices: fresh, sporty, floral and classic fragrances, each in Raza’s own interpretation.',
  },
};
function fromMin(list, type = null) {
  const all = list.map((p) => fromPrice(p, type)).filter((n) => n != null);
  return all.length ? Math.min(...all) : null;
}

/* ------------------------------------------------------------ layout */

const NAV = [['/#shop', 'Shop'], ['/attar', 'Attar'], ['/perfumes', 'Perfumes'], ['/oud', 'Oud'], ['/guides', 'Guides']];
const KIND_LINKS = [['/attar', 'Attar'], ['/perfumes', 'Perfumes'], ['/oud', 'Oud'], ['/luxury', 'Luxury'], ['/premium', 'Premium'], ['/regular', 'Regular']];

const CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#070504;color:#d9cdb6;font:300 16px/1.75 'Jost',system-ui,sans-serif}
a{color:#e0c283;text-underline-offset:3px;text-decoration-color:rgba(201,164,92,.5)}
a:hover{color:#f3dfa8}
.top{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 24px;padding:14px max(16px,4vw);background:rgba(7,5,4,.92);border-bottom:1px solid rgba(201,164,92,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.top img{display:block;width:120px;height:auto}
.top nav{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.top nav a{color:#bfb096;text-decoration:none}
.top nav a:hover,.top nav a[aria-current]{color:#ecd49a}
main{max-width:1180px;margin:0 auto;padding:36px max(16px,4vw) 72px}
.crumbs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px;padding:0;list-style:none;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9a8d77}
.crumbs li+li::before{content:'/';margin-right:8px;color:#5f5445}
.crumbs a{color:#bfb096;text-decoration:none}
.eyebrow{margin:0 0 10px;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#c9a45c}
h1{margin:0 0 14px;font:400 clamp(30px,5vw,52px)/1.12 'Cinzel',serif;letter-spacing:.08em;text-transform:uppercase;color:#ecd49a}
h2{margin:48px 0 14px;font:400 clamp(18px,2.2vw,22px)/1.35 'Cinzel',serif;letter-spacing:.12em;text-transform:uppercase;color:#ecd49a}
h3{margin:28px 0 8px;font:400 16px/1.4 'Cinzel',serif;letter-spacing:.1em;text-transform:uppercase;color:#ecd49a}
.lead{max-width:760px;margin:0 0 18px;font-size:clamp(17px,2vw,20px);color:#efe3c8}
.prose{max-width:760px}
.prose p,.prose li{color:#cbbfa6}
.prose strong{font-weight:500;color:#f0e3c8}
.note{font-size:14px;color:#a3957d}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0 8px}
.btn{display:inline-flex;align-items:center;gap:10px;padding:13px 24px;border:1px solid #c9a45c;border-radius:999px;font-size:11px;letter-spacing:.24em;text-transform:uppercase;text-decoration:none;color:#ecd49a}
.btn--solid{background:#c9a45c;color:#140d06}
.btn--solid:hover{background:#e0c283;color:#140d06}
.table{overflow-x:auto;margin:14px 0 6px}
table{width:100%;border-collapse:collapse;font-size:14.5px}
th,td{padding:11px 12px;text-align:left;border-bottom:1px solid rgba(201,164,92,.18);vertical-align:top}
thead th{font-weight:500;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ecd49a}
tbody th{font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:22px 18px;margin:18px 0 0;padding:0;list-style:none}
.card a{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:inherit}
.card__img{display:block;aspect-ratio:1;overflow:hidden;border:1px solid rgba(201,164,92,.18);border-radius:12px;background:radial-gradient(60% 60% at 50% 55%,rgba(201,164,92,.16),transparent 72%),#0c0906}
.card__img img{width:100%;height:100%;object-fit:cover;transition:transform .8s}
.card a:hover .card__img img{transform:scale(1.05)}
.card__meta{margin-top:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9a8d77}
.card__name{font:400 14px/1.35 'Cinzel',serif;letter-spacing:.08em;text-transform:uppercase;color:#ecd49a}
.card__price{font-size:13.5px;color:#bfb096}
.guides{display:grid;gap:14px;margin:18px 0 0;padding:0;list-style:none}
.guides a{display:block;padding:18px 20px;border:1px solid rgba(201,164,92,.2);border-radius:12px;text-decoration:none}
.guides b{display:block;font:400 16px/1.4 'Cinzel',serif;letter-spacing:.06em;color:#ecd49a}
.guides span{display:block;margin-top:4px;font-size:14px;color:#a3957d}
article.prose h1{font-size:clamp(28px,4.4vw,44px)}
.more{margin-top:48px;padding-top:24px;border-top:1px solid rgba(201,164,92,.18)}
.foot{border-top:1px solid rgba(201,164,92,.18);padding:36px max(16px,4vw) 56px;font-size:13.5px;color:#a3957d}
.foot__in{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:26px 40px}
.foot b{display:block;margin-bottom:8px;font-weight:500;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#ecd49a}
.foot ul{margin:0;padding:0;list-style:none}
.foot li{margin:3px 0}
.foot a{color:#cbbfa6;text-decoration:none}
.foot a:hover{color:#ecd49a}
.foot small{display:block;max-width:1180px;margin:30px auto 0;color:#9a8d77;font-size:12px}
.foot small a{text-decoration:underline;text-decoration-color:rgba(203,191,166,.5)}
@media (max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 12px}.top nav{gap:6px 16px;font-size:11px;letter-spacing:.14em}main{padding-top:24px}}
`;

function footer(guides) {
  const a = addressLine();
  return `<footer class="foot"><div class="foot__in">
  <div><b>Raza Perfume</b><p style="margin:0">Attars and perfumes since ${BUSINESS.since}<br />${esc(a)}${BUSINESS.mapsUrl ? `<br /><a href="${esc(BUSINESS.mapsUrl)}" target="_blank" rel="noopener">Find us on Google Maps</a>` : ''}</p></div>
  <div><b>Order &amp; contact</b><ul><li>WhatsApp <a href="https://wa.me/${SHOP.whatsapp}" target="_blank" rel="noopener">${esc(SHOP.whatsappLabel)}</a></li><li>Call <a href="tel:${esc(SHOP.phone)}">${esc(SHOP.phoneLabel)}</a></li><li>Instagram <a href="${esc(SHOP.instagram)}" target="_blank" rel="noopener">@raza_perfumenx2kalyan</a></li></ul></div>
  <div><b>Shop</b><ul>${KIND_LINKS.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="/#shop">All fragrances</a></li></ul></div>
  <div><b>Guides</b><ul>${guides.map((g) => `<li><a href="${g.path}">${esc(g.short || g.title.split(':')[0])}</a></li>`).join('')}</ul></div>
</div><small>© ${new Date().getFullYear()} Raza Perfume · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/license">License</a> · Fragrances marked “Inspired” are Raza’s own interpretations; Raza Perfume is not affiliated with the houses referenced.</small></footer>`;
}

function page({ path, title, description, image = '/og.jpg', lds = [], body, guides, current }) {
  const url = `${SITE}${path}`;
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="theme-color" content="#070504" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Raza Perfume" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}${image}" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  ${lds.map((x) => ld(x)).join('\n  ')}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>${CSS.trim()}</style>
</head>
<body>
  <header class="top">
    <a href="/" aria-label="Raza Perfume, home"><img src="/brand/raza-wordmark-light.svg" alt="Raza Perfume" width="654" height="170" /></a>
    <nav aria-label="Primary">${NAV.map(([h, t]) => `<a href="${h}"${h === current ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
  </header>
  <main>
${body}
  </main>
  ${footer(guides)}
</body>
</html>
`;
}

const crumbsHtml = (items) => `<nav aria-label="Breadcrumb"><ol class="crumbs">${items.map(([name, href], i) => `<li>${href && i < items.length - 1 ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</li>`).join('')}</ol></nav>`;

function card(p, kind, photosOf, { eager = false } = {}) {
  const shot = photosOf(p, kind)[0];
  const src = shot ? `/${shot.sm || shot.lg}` : `/media/products/${p.id}.webp`;
  const price = fromPrice(p, kind);
  const href = `/p/${encodeURIComponent(p.id)}${kind === 'attar' ? '?size=attar-6ml' : ''}`;
  return `<li class="card"><a href="${href}"><span class="card__img"><img src="${esc(src)}" alt="${esc(shot?.alt || p.name)}" width="600" height="600"${eager ? '' : ' loading="lazy"'} decoding="async" /></span><span class="card__meta">${esc(collectionLabel(p).replace(' collection', ''))} · No. ${pad(p.number)} · ${esc(originLabel(p))}</span><b class="card__name">${esc(p.name)}</b><span class="card__price">${price != null ? `${kind === 'attar' ? 'Attar' : 'Perfume'} from ${inr(price)}` : 'Price on request'}</span></a></li>`;
}

/* ------------------------------------------------------------ the pages */

export function seoPages(products, photosOf) {
  const shop = products.filter((p) => p.active !== false && COLLECTIONS.includes(p.category));
  const guides = readGuides();
  const out = [];
  const collectionLd = (path, name, description) => ({ '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE}${path}#page`, url: `${SITE}${path}`, name, description, isPartOf: { '@id': `${SITE}/#website` }, about: { '@id': `${SITE}/#store` } });
  const orderBlock = (what) => `<h2>How to order</h2>
<p>Choose ${what} and its size on the site, add it to your bag and send your order on WhatsApp: we confirm the price, availability and delivery with you there. We deliver across India, ${esc(SHIPPING.charAt(0).toLowerCase() + SHIPPING.slice(1))}. Prefer to talk? Call <a href="tel:${esc(SHOP.phone)}">${esc(SHOP.phoneLabel)}</a>.</p>`;

  // Attar, Perfumes, Oud
  for (const [key, def] of Object.entries(KIND_PAGES)) {
    const list = shop.filter(def.pick);
    const path = `/${key}`;
    const n = list.length;
    const title = def.title(n, list);
    const description = def.description(n, list);
    const groups = def.group ? COLLECTIONS.map((c) => [c, list.filter((p) => p.category === c)]).filter(([, l]) => l.length) : [[null, list]];
    let first = true;
    const grids = groups.map(([c, l]) => `<h2 id="${c || 'all'}">${c ? `${esc(COLLECTION_PAGE[c].label.replace(' collection', ''))} ${key === 'perfumes' ? 'perfumes' : key === 'attar' ? 'attars' : 'oud fragrances'} (${l.length})` : 'All'}</h2>
<ul class="grid">${l.map((p) => { const html = card(p, def.kind, photosOf, { eager: first }); first = false; return html; }).join('')}</ul>`).join('\n');
    const body = `${crumbsHtml([['Home', '/'], [def.h1.replace(' by Raza Perfume', ''), path]])}
<p class="eyebrow">Raza Perfume · Kalyan · Since ${BUSINESS.since}</p>
<h1>${esc(def.h1)}</h1>
<p class="lead">${esc(def.lead(n, list))}</p>
<div class="cta"><a class="btn btn--solid" href="#${groups[0][0] || 'all'}">See all ${n}</a><a class="btn" href="${waLink(`Hello Raza Perfume! I’d like help choosing ${key === 'attar' ? 'an attar' : key === 'oud' ? 'an oud fragrance' : 'a perfume'}.`)}" target="_blank" rel="noopener">Ask on WhatsApp</a></div>
<div class="prose">${def.intro()}
<h2>Prices</h2>
${priceTableHtml(list, def.types)}
${def.sections.map(([h, html]) => `<h2>${esc(h)}</h2>${html}`).join('\n')}
${orderBlock(key === 'attar' ? 'your attar' : 'your fragrance')}
</div>
${grids}`;
    out.push({ path, file: `${key}.html`, html: page({ path, title, description, lds: [collectionLd(path, title, description), breadcrumbLd([['Home', '/'], [def.h1, path]])], body, guides, current: path }) });
  }

  // the three collections
  for (const c of COLLECTIONS) {
    const list = shop.filter((p) => p.category === c);
    if (!list.length) continue;
    const def = COLLECTION_COPY[c];
    const path = COLLECTION_PAGE[c].path;
    const title = typeof def.title === 'function' ? def.title(list) : def.title;
    const perfume = fromMin(list, 'perfume');
    const attar = fromMin(list, 'attar');
    const description = `${def.intro.split(':')[0]}. ${list.length} fragrances from Raza Perfume, Kalyan: perfume from ${inr(perfume)}, attar from ${inr(attar)}. Order on WhatsApp.`;
    const others = COLLECTIONS.filter((x) => x !== c).map((x) => `<a href="${COLLECTION_PAGE[x].path}">${COLLECTION_PAGE[x].label}</a>`).join(' · ');
    const body = `${crumbsHtml([['Home', '/'], [COLLECTION_PAGE[c].label, path]])}
<p class="eyebrow">Raza Perfume · Kalyan · Since ${BUSINESS.since}</p>
<h1>${esc(def.h1)}</h1>
<p class="lead">${list.length} fragrances, each as perfume (from ${inr(perfume)}) and attar (from ${inr(attar)}).</p>
<div class="cta"><a class="btn btn--solid" href="/?c=${c}#shop">Shop the ${esc(COLLECTION_PAGE[c].label)}</a><a class="btn" href="${waLink(`Hello Raza Perfume! I have a question about the ${COLLECTION_PAGE[c].label}.`)}" target="_blank" rel="noopener">Ask on WhatsApp</a></div>
<div class="prose"><p>${esc(def.intro)}</p>
<p class="note">Fragrances marked “Inspired” are Raza’s own interpretations; the names describe their scent profile only. Raza Perfume is not affiliated with or endorsed by the houses referenced. <a href="/guides/inspired-perfumes">What “Inspired” means</a>.</p>
<h2>Prices</h2>
${priceTableHtml(list)}
<p>Also see: ${others} · <a href="/attar">All attars</a> · <a href="/perfumes">All perfumes</a> · <a href="/oud">Oud</a></p>
${orderBlock('a fragrance')}
</div>
<h2 id="all">The ${esc(COLLECTION_PAGE[c].label)} (${list.length})</h2>
<ul class="grid">${list.map((p, i) => card(p, 'perfume', photosOf, { eager: i < 4 })).join('')}</ul>`;
    out.push({ path, file: `${c}.html`, html: page({ path, title, description, lds: [collectionLd(path, title, description), breadcrumbLd([['Home', '/'], [COLLECTION_PAGE[c].label, path]])], body, guides, current: '' }) });
  }

  // guides
  const priceMd = priceTableMd(shop);
  for (const g of guides) {
    const md = g.body.replace('{{price-table}}', priceMd);
    const related = g.related.map((href) => {
      const guide = guides.find((x) => x.path === href);
      const label = guide ? guide.title.split(':')[0] : { '/attar': 'All attars', '/perfumes': 'All perfumes', '/oud': 'Oud fragrances', '/luxury': 'Luxury collection', '/premium': 'Premium collection', '/regular': 'Regular collection' }[href] || href;
      return `<li><a href="${href}">${esc(label)}</a></li>`;
    }).join('');
    const article = {
      '@context': 'https://schema.org', '@type': 'Article', '@id': `${SITE}${g.path}#article`, headline: g.title, description: g.description,
      datePublished: g.date, dateModified: g.updated || g.date, inLanguage: 'en-IN', mainEntityOfPage: `${SITE}${g.path}`, image: [`${SITE}/og.jpg`],
      author: { '@type': 'Organization', name: 'Raza Perfume', url: `${SITE}/` }, publisher: { '@id': `${SITE}/#store` },
    };
    const body = `${crumbsHtml([['Home', '/'], ['Guides', '/guides'], [g.title.split(':')[0], g.path]])}
<article class="prose">
<p class="eyebrow">Raza Perfume guides · <time datetime="${esc(g.date)}">${new Date(`${g.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p>
${markdownToHtml(md)}
</article>
<section class="more prose"><h2>Read next</h2><ul>${related}</ul>
<div class="cta"><a class="btn btn--solid" href="/#shop">Shop all fragrances</a><a class="btn" href="${waLink('Hello Raza Perfume! I’d like help choosing a fragrance.')}" target="_blank" rel="noopener">Ask on WhatsApp</a></div></section>`;
    out.push({ path: g.path, file: `guides/${g.slug}.html`, lastmod: g.updated || g.date, html: page({ path: g.path, title: `${g.title} | Raza Perfume`, description: g.description, lds: [article, breadcrumbLd([['Home', '/'], ['Guides', '/guides'], [g.title, g.path]])], body, guides, current: '/guides' }) });
  }
  {
    const path = '/guides';
    const title = 'Fragrance Guides: Attar, Oud & Perfume Tips | Raza Perfume';
    const description = 'Guides from Raza Perfume, Kalyan, since 1986: attar vs perfume, how to apply attar, making perfume last in Indian weather, oud, Kannauj attar and inspired perfumes.';
    const body = `${crumbsHtml([['Home', '/'], ['Guides', path]])}
<p class="eyebrow">Raza Perfume · Since ${BUSINESS.since}</p>
<h1>Fragrance guides</h1>
<p class="lead">Four decades behind the counter in Kalyan, written down: how to choose, wear and care for attar and perfume.</p>
<ul class="guides">${guides.map((g) => `<li><a href="${g.path}"><b>${esc(g.title)}</b><span>${esc(g.description)}</span></a></li>`).join('')}</ul>`;
    const listLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', url: `${SITE}${path}`, name: title, description, hasPart: guides.map((g) => ({ '@type': 'Article', headline: g.title, url: `${SITE}${g.path}` })) };
    out.push({ path, file: 'guides.html', html: page({ path, title, description, lds: [listLd, breadcrumbLd([['Home', '/'], ['Guides', path]])], body, guides, current: path }) });
  }
  return out;
}

// a link in a guide or page that points at a fragrance or page that doesn't exist
export function brokenLinks(pages, products) {
  const known = new Set([...pages.map((p) => p.path), '/', '/blogs', '/privacy', '/terms', '/license', ...products.map((p) => `/p/${p.id}`)]);
  const bad = [];
  for (const pg of pages) {
    for (const [, href] of pg.html.matchAll(/href="(\/[^"#?]*)/g)) {
      const clean = href.replace(/\/$/, '') || '/';
      if (!known.has(clean) && !/\.(png|svg|ico|webmanifest|jpg|webp)$/.test(clean)) bad.push(`${pg.path} → ${href}`);
    }
  }
  return [...new Set(bad)];
}

/* ------------------------------------------------------------ /p/<id> */

// The prerendered page of a fragrance: its details and prices are in the HTML
// (the browser then renders the interactive version over them), plus
// structured data for Google's product results.
export function productPage(html, p, products, photosOf) {
  const collection = collectionLabel(p);
  const cPath = COLLECTION_PAGE[p.category]?.path;
  const title = productTitle(p);
  const description = productDescription(p);
  const url = `${SITE}/p/${p.id}`;
  const shots = photosOf(p);
  const shot = shots[0];
  const og = shot?.og || shot?.lg;
  const image = og ? `${SITE}/${og}` : `${SITE}/media/products/${p.id}.webp`;
  const stageImg = shot?.lg ? `/${shot.lg}` : `/media/products/${p.id}.webp`;
  const crumbs = [['Home', '/'], ['Shop', '/#shop'], [collection, cPath || '/#shop'], [p.name, null]];
  const describe = p.description || (p.inspired
    ? `Raza’s own interpretation of a much-loved signature, from the ${collection.toLowerCase()}.`
    : `From the House of Raza’s ${collection.toLowerCase()}.`);
  const perfume = sizeList(p, 'perfume');
  const attar = sizeList(p, 'attar');
  const row = (label, sizes) => (sizes.length ? `<div><dt>${label}</dt><dd>${sizes.map((v) => `${v.ml} ml <b>${inr(v.price)}</b>`).join(' · ')}</dd></div>` : '');
  const info = `<p class="eyebrow">${esc(collection)} · No. ${pad(p.number)}</p>
        <div class="pp__head"><h1 class="pp__title">${esc(p.name)}</h1></div>
        <p class="qv__tag qv__tag--${p.inspired ? 'inspired' : 'original'}">${esc(originLabel(p))}</p>
        <p class="qv__origin">${esc(originLine(p))}</p>
        <p class="pp__desc">${esc(describe)}</p>
        <dl class="pp__prices">${row('Perfume', perfume)}${row('Attar', attar)}</dl>
        <a class="qv__ask" href="${waLink(`Hello Raza Perfume! I’d like to order ${p.name} (${collection}, No. ${pad(p.number)}).`)}" target="_blank" rel="noopener">Order on WhatsApp</a>`;
  const siblings = products.filter((x) => x.category === p.category && x.id !== p.id && x.active !== false);
  const at = siblings.findIndex((x) => x.number > p.number);
  const related = [...siblings.slice(Math.max(0, at)), ...siblings.slice(0, Math.max(0, at))].slice(0, 8);
  const relatedHtml = related.map((x) => {
    const s = photosOf(x)[0];
    return `<a class="pp__card" href="/p/${encodeURIComponent(x.id)}"><span class="pp__card-img"><img src="${esc(s ? `/${s.sm || s.lg}` : `/media/products/${x.id}.webp`)}" alt="" loading="lazy" /></span><b>${esc(x.name)}</b><span>${fromPrice(x) != null ? `From ${inr(fromPrice(x))}` : 'Price on request'}</span></a>`;
  }).join('');
  const isOud = has(p, 'oud');
  const sizesTable = [...perfume, ...attar].length ? `<div class="table"><table><thead><tr><th scope="col">Kind</th><th scope="col">Size</th><th scope="col">Price</th></tr></thead><tbody>${[...perfume, ...attar].map((v) => `<tr><td>${v.type === 'attar' ? 'Attar (perfume oil)' : 'Perfume (spray)'}</td><td>${v.ml} ml</td><td>${inr(v.price)}</td></tr>`).join('')}</tbody></table></div>` : '';
  const about = `<section class="pp__about" aria-labelledby="pp-about">
      <h2 class="pp__about-title" id="pp-about">About ${esc(seoName(p))}</h2>
      <div class="pp__about-body">
        <p>${esc(originLine(p))} It is No. ${pad(p.number)} of our <a href="${cPath || '/#shop'}">${esc(collection.toLowerCase())}</a>, and like every Raza fragrance it comes both as a <strong>perfume</strong> (a spray) and as an <strong>attar</strong> (a perfume oil).</p>
        ${sizesTable ? `<h3>Sizes and prices</h3>${sizesTable}` : ''}
        <h3>Perfume or attar?</h3>
        <p>The perfume spreads in a fine mist and fills the air around you; the attar is dabbed on and stays close to the skin. Many people wear both: a drop of attar under a spray of the same fragrance. <a href="/guides/attar-vs-perfume">Attar vs perfume, explained</a>.</p>
        <h3>How to order</h3>
        <p>Choose perfume or attar and a size, add it to your bag and send your order on WhatsApp; we confirm the price, availability and delivery with you there. We deliver across India, ${esc(SHIPPING.charAt(0).toLowerCase() + SHIPPING.slice(1))}. Or call <a href="tel:${esc(SHOP.phone)}">${esc(SHOP.phoneLabel)}</a>.</p>
        <p class="pp__about-links">More: <a href="${cPath || '/#shop'}">${esc(collection)}</a> · <a href="/attar">All attars</a> · <a href="/perfumes">All perfumes</a>${isOud ? ' · <a href="/oud">Oud fragrances</a>' : ''} · <a href="/guides">Fragrance guides</a></p>
      </div>
    </section>`;
  const lds = [
    ld(productLd(p, { image, soldOut: p.stock === 0 }), 'product'),
    ld(breadcrumbLd([['Home', '/'], ...(cPath ? [[collection, cPath]] : []), [p.name, `/p/${p.id}`]]), 'crumbs'),
  ].join('\n  ');
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${image}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace('</head>', `  ${lds}\n</head>`)
    .replace(/(<nav class="pp__crumbs"[^>]*>)[\s\S]*?(<\/nav>)/, `$1${crumbs.map(([n, h]) => (h ? `<a href="${h}">${esc(n)}</a>` : `<b>${esc(n)}</b>`)).join('<span>/</span>')}$2`)
    .replace(/<div class="pp__stage" data-stage><\/div>/, `<div class="pp__stage" data-stage><img src="${esc(stageImg)}" alt="${esc(shot?.alt || p.name)}" width="1200" height="1200" fetchpriority="high" /></div>`)
    .replace(/(<section class="pp__info" data-info>)[\s\S]*?(<\/section>)/, `$1\n        ${info}\n      $2`)
    .replace(/<section class="pp__related" data-related-wrap hidden>/, '<section class="pp__related" data-related-wrap>')
    .replace(/(<p class="eyebrow" data-related-title>)[^<]*/, `$1More from the ${esc(collection.toLowerCase())}`)
    .replace(/<div class="pp__related-row" data-related><\/div>/, `<div class="pp__related-row" data-related>${relatedHtml}</div>`)
    .replace('<!--pp:about-->', about);
}
