import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { legalPage, LEGAL } from './scripts/license-page.mjs';
import { seoPages, productPage, siteLdTag, addressLine, brokenLinks } from './scripts/seo-pages.mjs';
import { BUSINESS } from './src/content.js';

// A variable defined but left empty in the host's settings (Vercel → Settings →
// Environment Variables) would override .env.production and silently switch
// the live site and admin panel to demo mode. Empty means "not set". (Vite
// reads the environment after this file runs.)
for (const [k, v] of Object.entries(process.env)) if (k.startsWith('VITE_') && !String(v ?? '').trim()) delete process.env[k];

// "Browse 145 fragrances" in link previews and page copy follows the spreadsheet
const catalogFile = () => JSON.parse(readFileSync(new URL('./src/shop/catalog.json', import.meta.url), 'utf8'));
const productCount = () => catalogFile().products.length;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// the lowest price of a kind across the catalogue ("attar from ₹150")
const lowest = (type) => {
  const all = catalogFile().products.flatMap((p) => (p.variants || []).filter((v) => v.type === type && v.price != null).map((v) => Number(v.price)));
  return all.length ? `₹${Math.min(...all).toLocaleString('en-IN')}` : '';
};

// Public site address for link previews, canonical URLs and the sitemap: the
// live domain, so every copy of the site (including *.vercel.app) points
// search engines and shared links at www.razaperfume.com. SITE_URL overrides it.
const site = (process.env.SITE_URL || 'https://www.razaperfume.com').replace(/\/$/, '');

const loadProducts = async () => (await import(new URL('./src/shop/products.js', import.meta.url).href)).PRODUCTS;
const loadPhotos = async () => (await import(new URL('./src/shop/look.js', import.meta.url).href)).photosOf;
// the landing pages and guides (scripts/seo-pages.mjs)
const buildSeoPages = async () => seoPages(await loadProducts(), await loadPhotos());

function siteMeta() {
  return {
    name: 'raza-site-meta',
    // say so in the build log if the site would go live without its database
    configResolved(config) {
      const env = config.env || {};
      if (config.command === 'build' && !(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY))) {
        config.logger.warn('\n  Supabase isn’t configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY): the live site and admin panel will run in demo mode.\n');
      }
    },
    transformIndexHtml: async (html) => html
      .replaceAll('__SITE_URL__', site)
      .replaceAll('__PRODUCT_COUNT__', productCount())
      .replaceAll('__ATTAR_FROM__', lowest('attar'))
      .replaceAll('__PERFUME_FROM__', lowest('perfume'))
      .replaceAll('__ADDRESS__', addressLine())
      .replaceAll('__MAPS_URL__', BUSINESS.mapsUrl || 'https://www.google.com/maps/search/Raza+Perfume+NX2+Kalyan')
      .replace('<!--raza:site-ld-->', siteLdTag(await loadProducts())),
    // dev server: the same addresses as on Vercel (see vercel.json)
    //   /license, /privacy, /terms are rendered from Markdown · /blogs, /admin, /p/<fragrance>
    //   /attar, /perfumes, /oud, /luxury, /premium, /regular, /guides[/<slug>]
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const legal = req.url.match(/^\/(license|privacy|terms)(\.html)?\/?(\?|$)/);
        if (!legal) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(legalPage(legal[1]));
      });
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split(/[?#]/)[0].replace(/\/$/, '');
        if (!/^\/(attar|perfumes|oud|luxury|premium|regular|guides)(\/[a-z0-9-]+)?$/.test(path)) return next();
        const found = (await buildSeoPages()).find((p) => p.path === path);
        if (!found) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(found.html);
      });
      server.middlewares.use((req, res, next) => {
        if (/^\/blogs\/?(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/blogs\/?/, '/blogs.html');
        else if (/^\/admin\/?(\?|#|$)/.test(req.url)) req.url = req.url.replace(/^\/admin\/?/, '/admin.html');
        else if (/^\/p\/[^/?#]+\/?(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/p\/[^/?#]+\/?/, '/product.html');
        next();
      });
    },
    async generateBundle() {
      for (const key of Object.keys(LEGAL)) this.emitFile({ type: 'asset', fileName: `${key}.html`, source: legalPage(key) });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /tools/\nDisallow: /admin\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`,
      });
      const products = await loadProducts();
      const photosOf = await loadPhotos();
      const pages = await buildSeoPages();
      const broken = brokenLinks(pages, products);
      if (broken.length) this.warn(`links to pages that don't exist:\n  ${broken.join('\n  ')}`);
      for (const pg of pages) this.emitFile({ type: 'asset', fileName: pg.file, source: pg.html });
      if (site) {
        // with each fragrance's photo, so Google Images can show it too
        const photo = (p) => { const s = photosOf(p)[0]; return s ? `${site}/${s.og || s.lg}` : null; };
        const urls = [
          { u: '/' },
          ...pages.filter((pg) => !pg.path.startsWith('/guides')).map((pg) => ({ u: pg.path })),
          ...products.map((p) => ({ u: `/p/${p.id}`, img: photo(p) })),
          { u: '/guides' },
          ...pages.filter((pg) => pg.path.startsWith('/guides/')).map((pg) => ({ u: pg.path, mod: pg.lastmod })),
          { u: '/blogs' },
          { u: '/privacy' },
          { u: '/terms' },
        ];
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map(({ u, img, mod }) => `  <url><loc>${site}${u}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ''}${img ? `<image:image><image:loc>${esc(img)}</image:loc></image:image>` : ''}</url>`).join('\n')}\n</urlset>\n`,
        });
      }
    },
  };
}

// A real page per fragrance (p/<id>.html) with its own title, description and
// photo, so search engines and WhatsApp / Instagram link previews show the
// fragrance. Fragrances added later in the admin panel use product.html
// (vercel.json rewrite) and fill in the same details in the browser.
function productPages() {
  return {
    name: 'raza-product-pages',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_, bundle) {
      const page = bundle['product.html'];
      if (!page) return;
      // nested addresses (/p/…) need root-absolute asset links
      page.source = String(page.source).replace(/(src|href)="\.\/(?!\/)/g, '$1="/');
      // title, description, the photo it opens on (as a JPEG, which every
      // link preview reads), its details and prices, structured data
      const products = await loadProducts();
      const photosOf = await loadPhotos();
      for (const p of products) {
        this.emitFile({ type: 'asset', fileName: `p/${p.id}.html`, source: productPage(page.source, p, products, photosOf) });
      }
    },
  };
}

export default defineConfig({
  // relative asset paths so the built site works from any folder or sub-path
  base: './',
  plugins: [siteMeta(), productPages()],
  build: {
    target: 'es2022',
    // the story site, Blogs Raza, product pages and the admin panel
    rollupOptions: { input: { main: 'index.html', blogs: 'blogs.html', product: 'product.html', admin: 'admin.html' } },
    // three.js is intentionally bundled whole; the warning is expected
    chunkSizeWarningLimit: 1200,
  },
});
