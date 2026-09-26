import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { licensePage } from './scripts/license-page.mjs';

// "Browse 145 fragrances" in link previews and page copy follows the spreadsheet
const productCount = () => JSON.parse(readFileSync(new URL('./src/shop/catalog.json', import.meta.url), 'utf8')).products.length;

// Public site address for link previews, canonical URL and sitemap.
// On Vercel this comes from VERCEL_PROJECT_PRODUCTION_URL automatically;
// set SITE_URL (e.g. https://razaperfume.in) once a custom domain is live.
const site = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '');

function siteMeta() {
  return {
    name: 'raza-site-meta',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site).replaceAll('__PRODUCT_COUNT__', productCount()),
    // /license.html is rendered from LICENSE.md, live in dev and at build;
    // /blogs is blogs.html (Vercel does the same rewrite, see vercel.json)
    configureServer(server) {
      server.middlewares.use('/license.html', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(licensePage());
      });
      server.middlewares.use((req, res, next) => {
        if (/^\/blogs\/?(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/blogs\/?/, '/blogs.html');
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'license.html', source: licensePage() });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /tools/\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`,
      });
      if (site) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>${site}/blogs</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>\n`,
        });
      }
    },
  };
}

export default defineConfig({
  // relative asset paths so the built site works from any folder or sub-path
  base: './',
  plugins: [siteMeta()],
  build: {
    target: 'es2022',
    // two pages: the story site and Blogs Raza
    rollupOptions: { input: { main: 'index.html', blogs: 'blogs.html' } },
    // three.js is intentionally bundled whole; the warning is expected
    chunkSizeWarningLimit: 1200,
  },
});
