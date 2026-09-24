// Excel → website catalogue.
//
//   npm run import:products                       reads src/lib/ONLINE LIST.xlsx
//   npm run import:products -- "path/to/file.xlsx"
//
// The spreadsheet is the source of truth. Columns: SR NO · MATERIAL
// DISCRIPTION · COMPANY · QUANTITY · PRICE, in sections headed REGULAR /
// PREMIUM COLLECTION / LUXURY COLLECTION. Empty cells stay empty: a product
// without a price shows "Ask price" on the site, one without a quantity is
// simply not stock-tracked. Writes src/shop/catalog.json, then refreshes the
// Supabase seed.
import readXlsxFile from 'read-excel-file/node';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(root, process.argv[2] || 'src/lib/ONLINE LIST.xlsx');
const out = path.join(root, 'src/shop/catalog.json');

// every sheet is read, in order, so the list can also be split across sheets
const book = await readXlsxFile(source);
const rows = (Array.isArray(book[0]?.data) ? book.flatMap((s) => s.data) : book).map((r) => r || []);
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const sectionOf = (label) => {
  const s = label.toUpperCase();
  if (s.includes('LUXURY')) return 'luxury';
  if (s.includes('PREMIUM')) return 'premium';
  if (s.includes('REGULAR')) return 'regular';
  return null;
};
// "₹ 1,250", "1250/-", 1250 → 1250 · anything else → null
const money = (v) => {
  if (typeof v === 'number') return v > 0 ? Math.round(v * 100) / 100 : null;
  const m = text(v).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m && Number(m[0]) > 0 ? Number(m[0]) : null;
};
const count = (v) => {
  if (v === null || v === undefined || text(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(text(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
};

const products = [];
const problems = [];
let section = null;
rows.forEach((row, i) => {
  const [a, b, c, d, e] = row;
  const line = i + 1;
  const filled = row.filter((v) => text(v) !== '');
  if (!filled.length) return;
  // section headings: a single label in column A
  if (filled.length === 1 && typeof a === 'string' && sectionOf(a)) {
    section = sectionOf(a);
    return;
  }
  if (/^SR\s*NO/i.test(text(a))) return; // column headings
  if (!section) return problems.push(`row ${line}: product before any section heading — skipped`);
  if (!text(b)) return problems.push(`row ${line}: no product name — skipped`);
  const price = money(e);
  if (text(e) && price === null) problems.push(`row ${line}: price "${text(e)}" not understood — left empty`);
  products.push({
    category: section,
    number: typeof a === 'number' ? a : products.filter((p) => p.category === section).length + 1,
    sheetName: text(b).toUpperCase(),
    company: text(c) || null,
    quantity: count(d),
    price,
  });
});

writeFileSync(out, `${JSON.stringify({ source: path.basename(source), products }, null, 2)}\n`);

const by = (k) => products.filter((p) => p.category === k).length;
console.log(`${path.basename(source)} → src/shop/catalog.json`);
console.log(`  ${products.length} products: ${by('regular')} regular · ${by('premium')} premium · ${by('luxury')} luxury`);
console.log(`  with price: ${products.filter((p) => p.price !== null).length} · with quantity: ${products.filter((p) => p.quantity !== null).length}`);
problems.forEach((p) => console.log(`  ! ${p}`));

// names on the site come from src/shop/products.js; flag rows it doesn't know yet
const { PRODUCTS, UNREVIEWED } = await import(`../src/shop/products.js?t=${Date.now()}`);
if (UNREVIEWED.length) {
  console.log(`  ${UNREVIEWED.length} new name(s) shown as typed — add a tidy name in NAMES (src/shop/products.js):`);
  UNREVIEWED.forEach((n) => console.log(`    · ${n}`));
}
console.log(`  site catalogue: ${PRODUCTS.length} products`);
execFileSync(process.execPath, [path.join(root, 'scripts/seed-sql.mjs')], { stdio: 'inherit' });
