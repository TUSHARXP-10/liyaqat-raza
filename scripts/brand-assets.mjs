// Renders the link-preview image (public/og.jpg) and app icons (public/icons/)
// from tools/brand.html.   npm run brand:assets   (needs Google Chrome)
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = new URL('../public/', import.meta.url);
const file = (rel) => fileURLToPath(new URL(rel, pub));
mkdirSync(file('icons/'), { recursive: true });
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1300 } });
  await page.goto(`${server.resolvedUrls.local[0]}tools/brand.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth));

  await page.locator('#og').screenshot({ path: file('og.jpg'), type: 'jpeg', quality: 88 });
  for (const size of [512, 192, 180, 32]) {
    await page.evaluate((s) => document.getElementById('icon').style.setProperty('--s', `${s}px`), size);
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await page.locator('#icon').screenshot({ path: file(`icons/${name}`) });
  }
  console.log('wrote public/og.jpg and public/icons/*');
} finally {
  await browser.close();
  await server.close();
}
