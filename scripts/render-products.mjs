// Renders a studio image of the Raza bottle for every product into
// public/media/products/<id>.webp (transparent background).
//   npm run render:products             → all products
//   npm run render:products -- <id> …   → just these
// Needs Google Chrome installed (uses it headless through playwright-core).
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../public/media/products/', import.meta.url);
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  channel: process.env.CHROME_CHANNEL || 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])],
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${server.resolvedUrls.local[0]}tools/render-products.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.productIds);
  let bytes = 0;
  for (const [i, id] of ids.entries()) {
    const dataUrl = await page.evaluate((pid) => window.renderProduct(pid), id);
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    writeFileSync(new URL(`${id}.webp`, out), buf);
    bytes += buf.length;
    process.stdout.write(`\r${i + 1}/${ids.length} ${id}`.padEnd(60));
  }
  console.log(`\nrendered ${ids.length} images, ${(bytes / 1024).toFixed(0)} KB total`);
} finally {
  await browser.close();
  await server.close();
}
