// Real product photos → the shop.
//
//   npm run import:photos
//
// Put photos in "product image/", named after the fragrance as it appears on
// the site or in the spreadsheet. Spaces, underscores and the words "Raza
// Perfume" don't matter, so all of these work:
//   Gucci Oud.jpg · raza_perfume_cool_water.jpg · polo_red_raza_perfume.jpg
// A second photo of the same fragrance ends in a number or "alt":
//   Gucci Oud 2.jpg · raza_perfume_lomani_code_alt.jpg
// A designed card (notes, accords) that must be shown whole, never cropped,
// has "notes" or "card" in its name: Gucci Oud 2 notes.jpg
// A photo of one kind has "attar" or "perfume" in its name, and shows when
// the customer picks that kind: Blue Lady attar.jpg · Blue Lady attar 2.jpg
// "Attar bottles.jpg" (no fragrance name) is the general attar photo, shown
// with Attar for fragrances that have no attar photo of their own.
//
// Each becomes a square image in two sizes under public/media/photos/ (tall
// phone shots sit on a soft blurred copy of themselves, with the phone's
// watermark strip cropped off), listed in src/shop/photos.json. A fragrance
// with photos shows them on its card and in quick view (the first photo
// leads); the rest keep their studio render. Photos whose name isn't in the
// catalogue are kept and reported, and attach once the spreadsheet lists it.
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PRODUCTS, SIGNATURES } from '../src/shop/products.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const FOLDER = 'product image';
const src = path.join(root, FOLDER);
const out = path.join(root, 'public/media/photos');
const SIZES = { lg: 1200, sm: 600 };

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const all = [...PRODUCTS, ...SIGNATURES];
const find = (name) => {
  const s = slug(name);
  return s ? all.filter((p) => slug(p.name) === s || (p.sheetName && slug(p.sheetName) === s) || p.id === s) : [];
};

// "raza_perfume_lomani_code_alt.jpg" → { name: "lomani code", order: 2 }
// "Blue Lady attar 2.jpg"            → { name: "blue lady", order: 2, kind: "attar" }
// "Attar bottles.jpg"                → { general: true, kind: "attar" }
const GENERAL = new Set(['', 'bottle', 'bottles', 'range', 'general', 'collection']);
const tidy = (s) => s.replace(/\s+/g, ' ').trim();
function parse(file) {
  let words = tidy(file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[_\-.]+/g, ' '));
  words = tidy(words.replace(/\braza perfumes?\b/g, ' ')); // the brand, not the kind
  const card = /\b(notes|card)\b/.test(words);
  words = tidy(words.replace(/\b(notes|card)\b/g, ' '));
  const kind = words.match(/\b(attar|perfume)\b/)?.[1] || null;
  words = tidy(words.replace(/\b(attar|perfume)\b/g, ' '));
  let order = 1;
  if (!find(words).length) { // "555" is a name, not photo no. 555
    const m = words.match(/^(.*?)\s*(?:\(?(\d+)\)?|alt(?:\s*(\d+))?)$/);
    if (m && (find(m[1]).length || GENERAL.has(m[1]))) {
      words = m[1];
      order = m[2] ? Number(m[2]) : 2 + Number(m[3] || 0) * 0.01;
    }
  }
  return { name: words, order, card, kind, general: Boolean(kind) && GENERAL.has(words) };
}

const files = readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const parsed = files.map((f) => ({ file: f, ...parse(f) }));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

async function square(file, size) {
  const img = sharp(path.join(src, file)).rotate();
  const { width, height } = await img.metadata();
  const ratio = width / height;
  if (ratio > 0.85 && ratio < 1.18) {
    // already (nearly) square: fit whole, never enlarged
    const s = Math.min(size, Math.max(width, height));
    return img.resize(s, s, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  }
  // tall phone photo: drop the bottom strip (camera watermark), then the whole
  // shot centred on a darkened, blurred copy of itself
  const crop = ratio < 1 ? { left: 0, top: 0, width, height: Math.round(height * 0.94) } : { left: 0, top: 0, width, height };
  const shot = await sharp(path.join(src, file)).rotate().extract(crop).toBuffer();
  const back = await sharp(shot).resize(size, size, { fit: 'cover' }).blur(28).modulate({ brightness: 0.42, saturation: 0.8 }).toBuffer();
  const front = await sharp(shot).resize(size, size, { fit: 'inside' }).toBuffer();
  return sharp(back).composite([{ input: front, gravity: 'center' }]).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

const photos = {};
const unmatched = [];
let bytes = 0;
const KIND = { attar: 'Attar', perfume: 'Perfume' };
const byName = (a, b) => a.name.localeCompare(b.name) || Number(Boolean(a.kind)) - Number(Boolean(b.kind)) || a.order - b.order;
for (const { file, name, order, card, kind, general } of parsed.sort(byName)) {
  // general photos live under "*attar" / "*perfume", ahead of any product id
  const hits = general ? [{ id: `*${kind}`, name: `Raza ${KIND[kind]}`, file: kind }] : find(name);
  if (!hits.length) {
    unmatched.push(file);
    continue;
  }
  for (const p of hits) {
    const n = (photos[p.id]?.length || 0) + 1;
    // cards are shown whole; photos may be cropped to fill a frame
    const label = `${p.name}${kind && !general ? ` ${KIND[kind]}` : ''}`;
    const entry = { alt: `${label}${n > 1 ? `, photo ${n}` : ''}`, kind: card ? 'card' : 'photo' };
    if (kind) entry.for = kind;
    // a fingerprint in the name: a changed photo gets a new address, so
    // browsers never show last week's cached copy under the same name
    const bufs = Object.fromEntries(await Promise.all(Object.entries(SIZES).map(async ([key, size]) => [key, await square(file, size)])));
    const print = createHash('sha1').update(bufs.lg).digest('hex').slice(0, 8);
    for (const [key, buf] of Object.entries(bufs)) {
      const rel = `media/photos/${p.file || p.id}-${n}-${print}${key === 'sm' ? '-sm' : ''}.jpg`;
      writeFileSync(path.join(root, 'public', rel), buf);
      bytes += buf.length;
      entry[key] = rel;
    }
    (photos[p.id] ||= []).push(entry);
  }
}

writeFileSync(path.join(root, 'src/shop/photos.json'), `${JSON.stringify(photos, null, 2)}\n`);
const count = Object.values(photos).reduce((n, l) => n + l.length, 0);
console.log(`${FOLDER}/ → public/media/photos (${(bytes / 1e6).toFixed(1)} MB)`);
console.log(`  ${count} photo(s) on ${Object.keys(photos).filter((id) => id[0] !== '*').length} fragrance(s)`);
for (const [id, list] of Object.entries(photos)) {
  const name = id[0] === '*' ? `(every ${KIND[id.slice(1)]})` : all.find((p) => p.id === id).name;
  const kinds = [...new Set(list.map((e) => e.for).filter(Boolean))].map((k) => KIND[k]).join(', ');
  console.log(`    · ${name.padEnd(26)} ${list.length > 1 ? `${list.length} photos` : ''}${kinds ? ` [${kinds}]` : ''}`);
}
if (unmatched.length) {
  console.log(`  ${unmatched.length} photo(s) for names not in the catalogue (kept; they attach once the sheet lists them):`);
  unmatched.forEach((f) => console.log(`    · ${f}`));
}
