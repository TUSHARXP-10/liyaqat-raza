import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { licensePage } from './scripts/license-page.mjs';

// "Browse 145 fragrances" in link previews and page copy follows the spreadsheet
const productCount = () => JSON.parse(readFileSync(new URL('./src/shop/catalog.json', import.meta.url), 'utf8')).products.length;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Public site address for link previews, canonical URL and sitemap.
// On Vercel this comes from VERCEL_PROJECT_PRODUCTION_URL automatically;
// set SITE_URL (e.g. https://razaperfume.in) once a custom domain is live.
const site = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '');

const loadProducts = async () => (await import(new URL('./src/shop/products.js', import.meta.url).href)).PRODUCTS;

function siteMeta() {
  return {
    name: 'raza-site-meta',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', site).replaceAll('__PRODUCT_COUNT__', productCount()),
    // dev server: the same addresses as on Vercel (see vercel.json)
    //   /license.html is rendered from LICENSE.md · /blogs, /admin, /p/<fragrance>
    configureServer(server) {
      server.middlewares.use('/license.html', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(licensePage());
      });
      server.middlewares.use((req, res, next) => {
        if (/^\/blogs\/?(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/blogs\/?/, '/blogs.html');
        else if (/^\/admin\/?(\?|#|$)/.test(req.url)) req.url = req.url.replace(/^\/admin\/?/, '/admin.html');
        else if (/^\/p\/[^/?#]+\/?(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/p\/[^/?#]+\/?/, '/product.html');
        next();
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'license.html', source: licensePage() });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /tools/\nDisallow: /admin\n${site ? `\nSitemap: ${site}/sitemap.xml\n` : ''}`,
      });
      if (site) {
        const urls = [['/', '1.0'], ['/blogs', '0.8'], ...(await loadProducts()).map((p) => [`/p/${p.id}`, '0.7'])];
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr]) => `  <url><loc>${site}${u}</loc><changefreq>weekly</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`,
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
      const LABEL = { regular: 'Regular collection', premium: 'Premium collection', luxury: 'Luxury collection' };
      for (const p of await loadProducts()) {
        const collection = LABEL[p.category] || 'House signature';
        const title = `${p.name} — ${collection} | Raza Perfume`;
        const kinds = [...new Set((p.variants || []).map((v) => v.type))].filter(Boolean).join(' and ');
        const desc = `${p.name} from the ${collection.toLowerCase()} of Raza Perfume NX2, Kalyan.${kinds ? ` Available as ${kinds}.` : ''} Order on WhatsApp.`;
        const image = p.images?.[0]?.lg ? `/${p.images[0].lg}` : `/media/products/${p.id}.webp`;
        const url = `${site}/p/${p.id}`;
        const html = page.source
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
          .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
          .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
          .replace(/(<meta property="og:image" content=")[^"]*/, `$1${site}${image}`)
          .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
          .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`);
        this.emitFile({ type: 'asset', fileName: `p/${p.id}.html`, source: html });
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
