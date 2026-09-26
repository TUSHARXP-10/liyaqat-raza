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
//
// Each becomes a square image in two sizes under public/media/photos/ (tall
// phone shots sit on a soft blurred copy of themselves, with the phone's
// watermark strip cropped off), listed in src/shop/photos.json. A fragrance
// with photos shows them on its card and in quick view (the first photo
// leads); the rest keep their studio render. Photos whose name isn't in the
// catalogue are kept and reported, and attach once the spreadsheet lists it.
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

// "raza_perfume_lomani_code_alt.jpg" → { name: "lomani code", order: 2, card: false }
function parse(file) {
  let words = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  words = words.replace(/\braza perfumes?\b/g, ' ').replace(/\s+/g, ' ').trim();
  const card = /\b(notes|card)\b/.test(words);
  words = words.replace(/\b(notes|card)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (find(words).length) return { name: words, order: 1, card }; // "555" is a name, not photo no. 555
  const m = words.match(/^(.*?)\s*(?:\(?(\d+)\)?|alt(?:\s*(\d+))?)$/);
  if (m && find(m[1]).length) return { name: m[1], order: m[2] ? Number(m[2]) : 2 + Number(m[3] || 0) * 0.01, card };
  return { name: words, order: 1, card };
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
for (const { file, name, order, card } of parsed.sort((a, b) => a.name.localeCompare(b.name) || a.order - b.order)) {
  const hits = find(name);
  if (!hits.length) {
    unmatched.push(file);
    continue;
  }
  for (const p of hits) {
    const n = (photos[p.id]?.length || 0) + 1;
    // cards are shown whole; photos may be cropped to fill a frame
    const entry = { alt: `${p.name}${n > 1 ? `, photo ${n}` : ''}`, kind: card ? 'card' : 'photo' };
    for (const [key, size] of Object.entries(SIZES)) {
      const rel = `media/photos/${p.id}-${n}${key === 'sm' ? '-sm' : ''}.jpg`;
      const buf = await square(file, size);
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
console.log(`  ${count} photo(s) on ${Object.keys(photos).length} fragrance(s)`);
for (const [id, list] of Object.entries(photos)) console.log(`    · ${all.find((p) => p.id === id).name.padEnd(26)} ${list.length > 1 ? `${list.length} photos` : ''}`);
if (unmatched.length) {
  console.log(`  ${unmatched.length} photo(s) for names not in the catalogue (kept; they attach once the sheet lists them):`);
  unmatched.forEach((f) => console.log(`    · ${f}`));
}
