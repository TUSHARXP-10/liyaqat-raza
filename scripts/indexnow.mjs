// Tell Bing (and the other IndexNow search engines: Yandex, Seznam, Naver)
// that the site's pages are new or changed, so they crawl them within hours
// instead of weeks. Run after a deploy:  npm run indexnow
// It reads the live sitemap, so it always sends the current pages.
// The key proves we own the domain: public/<KEY>.txt is served at /<KEY>.txt.
const KEY = '4592bd9d78cd738cf45fed9c9b4a3e6a';
const SITE = (process.env.SITE_URL || 'https://www.razaperfume.com').replace(/\/$/, '');

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(SITE));
if (!urls.length) throw new Error(`no pages found in ${SITE}/sitemap.xml`);
const check = await fetch(`${SITE}/${KEY}.txt`);
if (!check.ok || (await check.text()).trim() !== KEY) throw new Error(`${SITE}/${KEY}.txt isn't live yet: deploy first`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
});
// 200 = received, 202 = received, key check pending
console.log(`IndexNow: sent ${urls.length} pages → ${res.status} ${res.statusText}`);
if (res.status >= 400) {
  console.log(await res.text());
  process.exitCode = 1;
}
