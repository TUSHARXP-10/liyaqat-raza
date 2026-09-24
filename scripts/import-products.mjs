// Excel → website catalogue.
//
//   npm run import:products                       reads src/lib/SHOP NX2 ONLINE LIST.xlsx
//   npm run import:products -- "path/to/file.xlsx"
//
// The spreadsheet is the source of truth. Sections are headed REGULAR /
// PREMIUM COLLECTION / LUXURY COLLECTION, and every product row starts with
// SR NO and MATERIAL DISCRIPTION (the name). The columns after those are read
// from the heading row, so they can come in any order:
//   30ML · 50ML · 100ML …  one price per size. A label on the row above the
//                          headings (PERFUME, ATTAR) names the kind of product
//                          for the size columns under and after it.
//   PRICE                  a single price (products sold in one size)
//   QUANTITY               units in stock
//   COMPANY                the maker
// Empty cells stay empty: a product without prices shows "Ask price" on the
// site, one without a quantity is simply not stock-tracked. Writes
// src/shop/catalog.json, then refreshes the Supabase seed.
import readXlsxFile from 'read-excel-file/node';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(root, process.argv[2] || 'src/lib/SHOP NX2 ONLINE LIST.xlsx');
const out = path.join(root, 'src/shop/catalog.json');

// every sheet is read, in order, so the list can also be split across sheets
const book = await readXlsxFile(source);
const rows = (Array.isArray(book[0]?.data) ? book.flatMap((s) => s.data) : book).map((r) => r || []);
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
// "ḶATAFA  yara" → "LATAFA YARA": stray accents and spacing never make a new product
const clean = (v) => text(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toUpperCase();
const sectionOf = (label) => {
  const s = label.toUpperCase();
  if (s.includes('LUXURY')) return 'luxury';
  if (s.includes('PREMIUM')) return 'premium';
  if (s.includes('REGULAR')) return 'regular';
  return null;
};
const SECTION_NAME = { regular: 'Regular', premium: 'Premium', luxury: 'Luxury' };
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

// What each column holds. Until a heading row says otherwise: the original
// layout, SR NO · NAME · COMPANY · QUANTITY · PRICE.
let columns = [null, null, { kind: 'company' }, { kind: 'quantity' }, { kind: 'price' }];
function readHeadings(row, groups) {
  return row.map((cell, j) => {
    if (j < 2) return null;
    const h = clean(cell);
    const ml = h.match(/^(\d+(?:\.\d+)?)\s*ML$/);
    if (ml) {
      // the kind of product is the nearest group label at or left of this column
      let type = null;
      for (let k = j; k >= 2 && groups; k--) {
        if (text(groups[k])) {
          type = clean(groups[k]).toLowerCase();
          break;
        }
      }
      return { kind: 'size', type, ml: Number(ml[1]) };
    }
    if (/QTY|QUANTITY|STOCK/.test(h)) return { kind: 'quantity' };
    if (/PRICE|MRP|RATE/.test(h)) return { kind: 'price' };
    if (/COMPANY|BRAND|MAKER/.test(h)) return { kind: 'company' };
    return null;
  });
}

const products = [];
const problems = [];
const seen = new Map(); // section|name → row
let section = null;
let groups = null; // the label row above the headings (PERFUME · ATTAR)
let unnamed = 0;

rows.forEach((row, i) => {
  const line = i + 1;
  const [a, b] = row;
  const filled = row.filter((v) => text(v) !== '');
  if (!filled.length) return;
  // section headings: a single label in column A
  if (filled.length === 1 && typeof a === 'string' && sectionOf(a)) {
    section = sectionOf(a);
    return;
  }
  if (/^SR\s*NO/i.test(text(a))) {
    columns = readHeadings(row, groups);
    groups = null;
    return;
  }
  const name = clean(b);
  if (!name) {
    if (text(a) === '' && row.slice(2).some((v) => typeof v === 'string' && text(v))) groups = row; // PERFUME · ATTAR
    else if (text(a) === '') unnamed += 1; // prices on a row without a product: an unused line
    else problems.push(`row ${line}: no product name — skipped`);
    return;
  }
  if (!section) return problems.push(`row ${line}: product before any section heading — skipped`);

  const key = `${section}|${name}`;
  if (seen.has(key)) {
    return problems.push(`row ${line}: ${name} is listed twice in ${SECTION_NAME[section]} (first at row ${seen.get(key)}) — kept the first`);
  }
  seen.set(key, line);

  const entry = { category: section, number: null, sheetName: name, company: null, quantity: null, price: null, variants: [] };
  columns.forEach((col, j) => {
    if (!col) return;
    const cell = row[j];
    if (col.kind === 'company') entry.company = text(cell) || null;
    else if (col.kind === 'quantity') entry.quantity = count(cell);
    else {
      const price = money(cell);
      if (text(cell) && price === null) problems.push(`row ${line}: price "${text(cell)}" not understood — left empty`);
      if (col.kind === 'price') entry.price = price;
      else if (price !== null) entry.variants.push({ type: col.type, ml: col.ml, price });
    }
  });
  // SR NO as typed; a row without one continues after the section's last number
  const typed = typeof a === 'number' ? a : /^\d+$/.test(text(a)) ? Number(text(a)) : null;
  entry.number = typed ?? Math.max(0, ...products.filter((p) => p.category === section).map((p) => p.number)) + 1;
  products.push(entry);
});

writeFileSync(out, `${JSON.stringify({ source: path.basename(source), products }, null, 2)}\n`);

const by = (k) => products.filter((p) => p.category === k).length;
const sized = products.filter((p) => p.variants.length);
const sizes = [...new Set(sized.flatMap((p) => p.variants.map((v) => `${v.type ? `${v.type} ` : ''}${v.ml} ml`)))];
console.log(`${path.basename(source)} → src/shop/catalog.json`);
console.log(`  ${products.length} products: ${by('regular')} regular · ${by('premium')} premium · ${by('luxury')} luxury`);
console.log(`  priced by size: ${sized.length}${sizes.length ? ` (${sizes.join(', ')})` : ''} · single price: ${products.filter((p) => p.price !== null).length} · ask price: ${products.filter((p) => !p.variants.length && p.price === null).length}`);
console.log(`  with quantity: ${products.filter((p) => p.quantity !== null).length}`);
if (unnamed) console.log(`  skipped ${unnamed} row(s) with prices but no product name`);
problems.forEach((p) => console.log(`  ! ${p}`));

// names on the site come from src/shop/products.js; flag rows it doesn't know yet
const { PRODUCTS, UNREVIEWED } = await import(`../src/shop/products.js?t=${Date.now()}`);
if (UNREVIEWED.length) {
  console.log(`  ${UNREVIEWED.length} new name(s) shown as typed — add a tidy name in NAMES (src/shop/products.js):`);
  UNREVIEWED.forEach((n) => console.log(`    · ${n}`));
}
console.log(`  site catalogue: ${PRODUCTS.length} products`);
execFileSync(process.execPath, [path.join(root, 'scripts/seed-sql.mjs')], { stdio: 'inherit' });
