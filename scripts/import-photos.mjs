// Real product photos → the shop.
//
//   npm run import:photos
//
// Put photos in product-photos/, named after the fragrance as it appears on
// the site or in the spreadsheet: "Gucci Oud.jpg", "Gucci Oud 2.jpg" (a second
// photo), "Rasasi Hawas.png" … Each becomes a square image (tall phone shots
// sit on a soft blurred backdrop of themselves, with the phone's watermark
// strip cropped off) in two sizes under public/media/photos/, listed in
// src/shop/photos.json. A fragrance with photos shows them on its card and in
// quick view (the first photo leads); the rest keep their studio render.
// Photos for names not in the catalogue are kept and reported, and attach
// automatically once the spreadsheet lists that fragrance.
import sharp from 'sharp';
import { readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PRODUCTS, SIGNATURES } from '../src/shop/products.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = path.join(root, 'product-photos');
const out = path.join(root, 'public/media/photos');
const SIZES = { lg: 1200, sm: 600 };

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const all = [...PRODUCTS, ...SIGNATURES];
const find = (name) => {
  const s = slug(name);
  return all.filter((p) => slug(p.name) === s || (p.sheetName && slug(p.sheetName) === s) || p.id === s);
};

// "Gucci Oud 2.jpg" → { name: "Gucci Oud", order: 2 }
const files = readdirSync(src).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const parsed = files.map((f) => {
  const base = f.replace(/\.[^.]+$/, '').trim();
  const m = base.match(/^(.*?)(?:\s*\(?(\d+)\)?)?$/);
  const tries = [base, m[1]]; // "555.jpg" is a fragrance name, not photo no. 555
  const name = tries.find((t) => find(t).length) ?? m[1];
  return { file: f, name, order: name === base ? 1 : Number(m[2] || 1) };
});

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// designed, (nearly) square cards (notes, accords) are shown whole; camera
// shots may be cropped to fill a frame
async function kindOf(file) {
  const { width, height } = await sharp(path.join(src, file)).rotate().metadata();
  const ratio = width / height;
  return ratio > 0.85 && ratio < 1.18 ? 'card' : 'photo';
}

async function square(file, size) {
  const img = sharp(path.join(src, file)).rotate();
  const { width, height } = await img.metadata();
  const ratio = width / height;
  if (ratio > 0.85 && ratio < 1.18) {
    // already (nearly) square, e.g. designed cards: fit whole on white
    return img.resize(size, size, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
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
for (const { file, name, order } of parsed.sort((a, b) => a.name.localeCompare(b.name) || a.order - b.order)) {
  const hits = find(name);
  if (!hits.length) {
    unmatched.push(file);
    continue;
  }
  for (const p of hits) {
    const n = (photos[p.id]?.length || 0) + 1;
    const entry = { alt: `${p.name}${n > 1 ? `, photo ${n}` : ''}`, kind: await kindOf(file) };
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
console.log(`product-photos/ → public/media/photos (${(bytes / 1024).toFixed(0)} KB)`);
console.log(`  ${count} photo(s) on ${Object.keys(photos).length} fragrance(s):`);
for (const [id, list] of Object.entries(photos)) console.log(`    · ${all.find((p) => p.id === id).name} (${id}): ${list.length}`);
if (unmatched.length) {
  console.log(`  ${unmatched.length} photo(s) for names not in the catalogue (kept; they attach once the sheet lists them):`);
  unmatched.forEach((f) => console.log(`    · ${f}`));
}
