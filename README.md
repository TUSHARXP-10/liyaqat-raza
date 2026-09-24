# Raza Perfume — cinematic story site

A scroll-driven "film" built around a single real-time 3D bottle that travels through
every chapter. It gets taken apart in the Anatomy chapter and changes fragrance in the Collection.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — upload anywhere
npm run preview  # serve the built dist/ locally
```

Open with `?skip` (e.g. `http://localhost:5173/?skip`) to bypass the preloader while developing.

## The Atelier (store)

Chapter VI (`#shop`) lists every fragrance from the client's spreadsheet. Checkout opens WhatsApp to
**+91 89760 35333** with the order written out. The call number **+91 90295 04320** appears in quick
view, the bag and the footer.

**Updating products, prices and stock: the spreadsheet is the source of truth.**

1. Edit `src/lib/ONLINE LIST.xlsx`, keeping the sections REGULAR / PREMIUM COLLECTION / LUXURY
   COLLECTION and the columns SR NO · MATERIAL DISCRIPTION · COMPANY · QUANTITY · PRICE.
   - PRICE: `499`, `₹ 499` or `499/-` all work. Leave it empty and the site offers
     **Ask price on WhatsApp**.
   - QUANTITY: leave it empty for "not tracked". `0` shows **Sold out** (add disabled, ask
     availability instead). `1–5` shows **Only n left**, and customers can't add more than you have.
2. Run `npm run import:products`. It writes `src/shop/catalog.json` and refreshes
   `supabase/seed.sql`, then reports counts plus anything it couldn't read (e.g. a price typed as
   text) and any new product names.
3. For a new product, add a tidy display name in `NAMES` (`src/shop/products.js`); until then it
   shows the sheet spelling in title case. Then run `npm run render:products -- <id>` for its photo,
   and commit.

With Supabase connected, the same prices and stock can also be changed live in the dashboard
(`products` table). Re-running the seed never wipes a dashboard value with an empty spreadsheet cell.

**What shoppers get:**

- **Browse:** collection tabs, Raza originals / Inspired filters, and a ♥ wishlist with a "Saved"
  filter, all with live counts.
- **Search:** tolerates typos ("savage" → Dior Sauvage, "levender" → Lavender Oud), matches
  collection numbers ("16"), highlights matches, and shows "Did you mean …" when nothing matches.
  Press `/` to jump to it.
- **Layout and sorting:** grid or list layout (remembered); sort by name, and by price once prices
  exist; sold-out items sink to the end.
- **Shareable views:** active filters appear as removable pills and are kept in the address bar,
  so a filtered view can be shared.
- **Product cards:** photo, number, collection, Inspired tag, stock badge, price or "Ask price",
  and Add turning into a quantity stepper.
- **Quick view:** quantity and stock, Ask on WhatsApp, share link, save, prev/next with keys or
  swipe, and "More from this collection".
- **Photos:** studio renders of the Raza bottle in `public/media/products/`
  (`npm run render:products`, needs Google Chrome). A real photo can replace any render via
  `image_url` in Supabase.

### Supabase setup (one time)

1. Supabase → **SQL Editor**: paste and run `supabase/schema.sql`, then `supabase/seed.sql`.
2. Supabase → **Project Settings → API Keys**: copy the **Publishable key**.
3. Vercel → **Settings → Environment Variables**, then redeploy:
   - `VITE_SUPABASE_URL` = `https://unsrlrbbgjecswbswncc.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the key from step 2

Orders then land in the `orders` table (the `order_overview` view is the readable list) before
the WhatsApp message is sent. The public key can only read products and place orders through
`place_order`, which takes prices from the database. See the comments in `schema.sql`.
Without these variables the store still works: it uses the bundled catalogue and goes straight to WhatsApp.

## Deploy (Vercel)

The repo is Vercel-ready (`vercel.json`):

1. In Vercel choose **Add New → Project** and import `TUSHARXP-10/liyaqat-raza`.
2. Keep the detected settings (Framework **Vite**, build `npm run build`, output `dist`) and click **Deploy**.

Every push to `main` then redeploys automatically. Hashed build assets are cached for a year, and `/media` for a week.

## The story, chapter by chapter

| # | Chapter | What happens |
|---|---------|--------------|
| — | Title sequence (`src/ui/intro.js`, ~7.7 s) | The site loads during the sequence. Gold particles spiral in and form the Raza logo, a light sweep crosses it, then a black hole opens and swallows it. After a flash: "Since 1986 · razaperfume.com", then the license credit for Webzoo Innovation, and the curtain opens. It has Skip and a sound toggle, and plays on every page load, refreshes included. Only `?skip` (for development) goes straight in. |
| I | Prologue (`#hero`) | The bottle rises onto a marble plinth in a Moorish colonnade while liquid-gold ribbons pour around it. Slides 01/02/03 switch the headline and turn the bottle into Base, Oud or Musk. |
| II | Anatomy (`#anatomy`, pinned) | The bottle comes apart piece by piece: cap, R seal, spray, collar, glass, fragrance, base. Each label is attached to the actual 3D part and follows it. It then snaps back together. |
| III | Origins (`#story`, pinned) | The screen turns to sepia film and an odometer rewinds 2026 → 1986. The counter lands in "Established in 1986", then the real photograph of founder **Yasinali Sayyad** at his counter drops in and develops. His name and story take over the panel, and his words *"Sugandh se rishte bante hain"* write themselves in script, signed. Colour then returns over a dusk skyline. |
| IV | The House Today (`#founder`) | **Liyaqat Sayyad**, founder and owner of Raza Perfume today and Yasinali's son. His portrait sits in a wide Mughal arch beside incense smoke from a brass burner, and his quote lights up word by word as you scroll. |
| V | Collection (`#collection`, pinned) | The bottle spins through Base → Oud → Musk. Liquid, glass tint, label, splash colour and backdrop grade all change with it. |
| — | Promises / Journey | Line icons draw themselves. A giant RAZA rises from the footer and the gold follows the cursor. |

## Where to edit things

| What | File |
|------|------|
| All page copy | `index.html` |
| Fragrance colours (liquid, glass, splash) | `src/content.js` |
| Where the bottle sits / turns / explodes on each scroll beat | `src/story/keyframes.js` |
| Text & scene choreography per chapter | `src/story/chapters.js` |
| Bottle geometry, materials, anatomy anchors | `src/three/Bottle.js` |
| Engraved cap, label, marble, R seal (all painted in code) | `src/three/textures.js` |
| Colonnade, skyline, rosette scenery | `src/ui/backdrops.js` |
| Ambient sound (generative, no audio files) | `src/ui/sound.js` |
| Styles & responsive rules | `src/styles/main.css` |

## Brand logo

The Raza Perfume NX2 logo (`brand-source/raza-logo-original.png`) is traced into vector art so it
stays sharp at any size:

- `public/brand/raza-logo.svg`: original black & gold, for light backgrounds and print.
- `public/brand/raza-logo-light.svg`, `raza-mark-light.svg`, `raza-wordmark-light.svg`: gold
  versions for the dark site. They're used in the nav, footer and 404 page.
- `src/brand/logo.js`: the same art as canvas paths. It's used in the intro particles and on the
  3D bottle label, and therefore in every product photo.

If the logo changes, re-trace it, then run `npm run render:products` and `npm run brand:assets`.

## Assets

- `public/media/yasinali-sayyad-1986.jpg`: the founder, Yasinali Sayyad, at the first Raza counter (Origins chapter).
- `public/media/liyaqat-sayyad.jpg`: Liyaqat Sayyad (Chapter IV, landscape, about 1.4:1).
  It appears inside the arch automatically. If the file is missing, a candle shows in its place.
- `public/media/anatomy.jpg` is only shown if a visitor's device can't run WebGL.

## Content to confirm with the client

- **Yasinali Sayyad's "about"** (Origins chapter) is a draft written from his photograph. "Bombay" and the oud / musk / amber / rose / sandal blends come from the signage in that photo.
- **Liyaqat Sayyad's "about"** (Chapter IV) is a draft. It presents him as founder and owner of Raza Perfume today, carrying forward what his father Yasinali began in 1986 (credited as "The first founder · Est. 1986"). His quote, "True luxury is not seen, it is felt.", comes from the original wireframe.
- **Fragrance notes and descriptions** in the Collection chapter are placeholder copy written for the layout.
- Social links, the "Add to bag" counter and the newsletter form are front-end only. Connect them to the shop/CRM.

## License

`LICENSE.md` is the Website License Agreement between Webzoo Innovation (licensor, owns the design and
code) and Raza Perfume (licensee, owns its brand, photos, products and customer data). It is published as
`/license.html` and linked from the footer. Fill in the `[bracketed]` fields (addresses, date, city,
invoice reference) and have it signed.

## Tech

Vite · Three.js (physical glass with transmission and dispersion, PMREM studio lighting) ·
GSAP (ScrollTrigger, SplitText, DrawSVG) · Lenis smooth scroll. No image or audio files are
needed. Everything is procedural, so it stays sharp at any resolution.

Performance: the pixel ratio is capped and steps down automatically if frames slow down. The canvas
stops rendering while it's off screen. Smoke only runs while visible, and `prefers-reduced-motion` disables smooth scrolling.

**Intro smoothness.** The site loads during the intro, so the intro is built so that loading can't
touch it:

- The particle and black-hole canvas runs in a Web Worker (`src/ui/intro.worker.js` + OffscreenCanvas).
  Browsers without OffscreenCanvas run the same renderer on the main thread.
- The text beats and the curtain are CSS animations of opacity, transform and blur, so the compositor
  runs them.
- Nothing under the intro paints or animates until the curtain opens (`html.is-covered`).
- The 3D engine never blocks the GPU:
  - The studio reflection map is pre-baked (`public/media/env/studio.hdr`, `npm run bake:env`).
  - Every shader variant is compiled in the background before first use, including the
    glass-refraction pass.
  - Textures upload one per frame while the intro still covers the page.

Measured in Chrome: intro frames p95 ≈ 7 ms, with no multi-second stalls (previously up to 1.9 s).
