import { REELS, CATEGORIES } from '../blog/reels.js';
import MEDIA from '../blog/media.json' with { type: 'json' };

// Blogs Raza films as the admin sees them: the ones bundled with the site
// (src/blog/reels.js), with any changes saved in the database laid over them,
// plus films uploaded from the admin panel.

export { CATEGORIES };
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

export const BUNDLED = REELS.filter((r) => MEDIA.reels[r.slug]).map((r, i) => {
  const m = MEDIA.reels[r.slug];
  return {
    slug: r.slug, title: r.title, text: r.text, category: r.cat, product_id: r.product || null,
    featured: Boolean(r.featured), sort: i, active: true, video_url: null,
    poster_url: `/media/blog/${m.poster}`, video: `/media/blog/${m.video}`, duration: m.duration, bundled: true,
  };
});

export async function allFilms(store) {
  const rows = await store.get('films').catch(() => []);
  const bySlug = new Map(BUNDLED.map((f) => [f.slug, { ...f }]));
  for (const r of rows) {
    const b = bySlug.get(r.slug);
    bySlug.set(r.slug, {
      ...(b || {}), ...r, bundled: Boolean(b), edited: true,
      poster_url: r.poster_url || b?.poster_url, video: r.video_url || b?.video,
    });
  }
  return [...bySlug.values()].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort);
}
