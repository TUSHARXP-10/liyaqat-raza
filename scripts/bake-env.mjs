// Bakes the studio lighting environment to public/media/env/studio.hdr.
//   npm run bake:env   (needs Google Chrome)
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../public/media/env/studio.hdr', import.meta.url));
mkdirSync(fileURLToPath(new URL('../public/media/env/', import.meta.url)), { recursive: true });
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
  await page.goto(`${server.resolvedUrls.local[0]}tools/bake-env.html`);
  const { base64, w, h } = await page.waitForFunction(() => window.baked, null, { timeout: 120000 }).then((r) => r.jsonValue());
  const buf = Buffer.from(base64, 'base64');
  writeFileSync(out, buf);
  console.log(`wrote public/media/env/studio.hdr (${w}x${h}, ${(buf.length / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
  await server.close();
}
