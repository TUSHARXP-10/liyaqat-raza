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

1. Edit `src/lib/SHOP NX2 ONLINE LIST.xlsx`. Keep the sections REGULAR / PREMIUM COLLECTION /
   LUXURY COLLECTION, with SR NO and MATERIAL DISCRIPTION (the name) in the first two columns.
   The columns after the name are read from their heading, so they can be in any order:
   - **Sizes:** columns headed `30ML`, `50ML`, `100ML`, `6ML`, `12ML` … hold one price per size.
     A label on the row above the headings (`PERFUME`, `ATTAR`) sets the kind for the size columns
     under it and to its right. The sizes apply to every section below the heading row, so every
     fragrance (Regular, Premium and Luxury) is offered as Perfume 30/50/100 ml and Attar 6/12 ml.
     Customers pick Perfume or Attar (on the card or in quick view), then the size.
   - **Prices:** Regular is priced (Perfume ₹250/₹400/₹900, Attar ₹150/₹250), and the card shows
     "From ₹150". To price Premium or Luxury, type the prices in the same five columns on their
     rows. An empty cell means that size is **on request**: customers can still choose it, add it
     to the bag, and ask its price on WhatsApp.
   - **PRICE:** a single price, for products sold in one size. `499`, `₹ 499` or `499/-` all work.
   - **QUANTITY** (optional): leave it empty for "not tracked". `0` shows **Sold out** (add
     disabled, ask availability instead). `1–5` shows **Only n left**, and customers can't add
     more than you have.
2. Run `npm run import:products`. It writes `src/shop/catalog.json` and refreshes
   `supabase/seed.sql`. It then reports counts, plus anything it couldn't read: a price typed as
   text, a product listed twice in a section (the first is kept), or new product names.
3. For a new product, add a tidy display name in `NAMES` (`src/shop/products.js`); until then it
   shows the sheet spelling in title case. Then run `npm run render:products -- <id>` for its photo,
   and commit.

Product links stay valid when a fragrance moves collection: `?p=premium-dior-sauvage` still opens
Dior Sauvage after it moved to Regular. A link can also open on a size: `?p=regular-dior-sauvage&size=attar-12ml`.

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
- **Product cards:** photo, number, collection, Inspired tag, and a **Perfume | Attar toggle with
  the ml sizes right on the card**. The card shows the price of the selected size (or "Ask price"
  for that exact size), and Add puts that size straight in the bag, turning into a quantity stepper.
  A dot marks sizes already in the bag. Each card remembers its choice per kind (back to Attar
  returns to the attar size picked before). Untouched cards start on the kind and size last
  picked, and quick view opens on the card's choice and stays in step with it. Arrow keys work
  inside the toggle and sizes.
- **Quick view:** Perfume / Attar and size picker with each size's price. It remembers the last
  size picked when moving to the next fragrance, and shows a count on sizes already in the bag.
  Also quantity and stock, Ask on WhatsApp, share link (including the size), save, prev/next with
  keys or swipe, and "More from this collection".
- **Bag and order:** one line per size ("Cool Water, Attar · 12 ml × 3 — ₹750"), in the bag, the
  WhatsApp message and the Supabase order. The database prices each size itself.
- **Photos:** real photos come first. Drop them in `product image/`, named after the fragrance
  (`Gucci Oud.jpg`, `raza_perfume_cool_water.jpg`; a second photo ends in a number or `_alt`; a designed notes card has "notes" in its name and is never cropped), then run `npm run import:photos`.
  Each is made square in two sizes; tall phone shots sit on a blurred copy of themselves, with the
  camera watermark strip cropped off. A fragrance with photos shows the first on its card, and all
  of them in quick view with thumbnails. Designed cards (notes, accords) are always shown whole.
  **Attar photos:** a name with "attar" in it (`Blue Lady attar.jpg`, `Blue Lady attar 2.jpg`) is
  shown when the customer picks Attar, on the card, in quick view, on the product page and in the
  bag. `Attar bottles.jpg` / `Attar bottles 2.jpg` (no fragrance name) are the general attar photos,
  shown with Attar for every fragrance that has no attar photo of its own. "perfume" works the same
  way. In the admin panel each photo has a "Shows with" tag (Perfume & Attar, Perfume, Attar).
  Photos whose name isn't in the spreadsheet are kept and reported, and attach once the sheet lists
  that fragrance. Fragrances without photos show a studio render of the Raza bottle from
  `public/media/products/` (`npm run render:products`, needs Google Chrome). `image_url` in
  Supabase overrides both.

## Blogs Raza (`/blogs`)

A second page, linked from the nav as **Blogs Raza**, showcasing the brand's films and photos:

- **Hero:** a tilted wall of films drifting behind the title.
- **Signature films:** the brand's own picks, in a draggable rail with hover previews.
- **The library:** every film, filterable (Fragrance films, The blind test, In the lab, At the
  counter). Hover plays a silent preview on desktop; on phones, the card in the middle of the
  screen previews.
- **The player:** full-screen, one film per screen like reels. Swipe, scroll or ↑ ↓ to move
  between films, and the next one starts when a film ends. It has sound on/off, "Ask on WhatsApp",
  Share (`/blogs?v=<film>`, which opens silently with "Tap for sound"), and **Shop this
  fragrance** when the film shows a product.
- **Moments:** a photo wall with a lightbox.

Films that show a fragrance also appear in that fragrance's quick view in the shop (a ▶ Film
badge on the card, and a film thumbnail that plays in place).

**Adding a film:**
1. Put the raw file in `src/story/blog content/`. That folder is not committed; only the web copies are.
2. Add a line to `REELS` in `src/blog/reels.js`: title, one-line text, category, and optionally
   `featured` and the shop `product` id.
3. Run `npm run import:blog`. It needs ffmpeg: on PATH, or `FFMPEG=path/to/ffmpeg`, or
   `npm i -D ffmpeg-static`. It writes a 720p film, a 4-second silent preview and a poster to
   `public/media/blog/`, skipping anything already up to date.

Left out on purpose: re-exports of the same clip (each kept once), the expired
"15% / 25% off, 29–31 May" offer, and a lab clip carrying another brand's watermark (@infiniparfums).

## Product pages (`/p/<fragrance>`)

Every fragrance has its own page, for example `/p/regular-cool-water` or `/p/luxury-rasasi-hawas?size=attar-12ml`:

- **The page:** a gallery of photos and the fragrance's films, the Perfume / Attar toggle and
  sizes, the price, quantity, Add to bag (the same bag and WhatsApp checkout as the shop),
  Ask on WhatsApp for that exact size, Share, and "More from the collection". On phones, a buy
  bar stays in reach.
- **SEO and sharing:** the build writes a real page per fragrance (`dist/p/<id>.html`) with its
  own title, description and photo, so Google and WhatsApp / Instagram link previews show the
  fragrance. It also adds Google product data (price range, availability) and lists every page
  in the sitemap.
- **Links:** old links still land on the right page after a fragrance moves collection. The
  shop's quick view has "View full details", share links point here, and so does "Shop this
  fragrance" on the Blogs page.

## Admin panel (`/admin`) — the CMS

The client runs the site from `/admin`: no code, no spreadsheet needed.

| Section | What it does |
|---|---|
| Dashboard | Fragrances on the site, % of sizes priced, orders this week, subscribers, and a to-do list ("72 fragrances on request → Set prices", "new orders", "no photo yet"). |
| Products | Search and filter (collection, hidden, featured, no photo, price on request); show/hide and feature from the list; edit several at once. |
| Product editor | Name, collection, number, stock, description, Inspired tag; sizes and prices (Perfume / Attar / other, any ml; empty = on request); photos with upload (resized to WebP in the browser), drag to reorder (the first is the cover), "show whole" for designed cards; show on site / featured; live preview; delete (products that were ordered can only be hidden). Unsaved changes are guarded. |
| Price list | Every size of every fragrance in one grid: type and press Enter down a column, or "Fill" a whole column for the fragrances shown (e.g. all Premium Perfume 30 ml at ₹450), then one Save. |
| Orders | By status, with search; each order has WhatsApp and Call buttons for the customer and one-tap New → Confirmed → Shipped → Delivered (or Cancelled). |
| Site content | Every block of copy: announcement bar (on/off, text, button), the three opening slides, the origins and founder stories and quotes, Base / Oud / Musk descriptions and notes, shop text, promises, contact numbers (orders, calls, Instagram), SEO, the Blogs intro. Edited fields are marked and can be reset to the original. |
| Films | All Blogs Raza films: edit the title, text and category, link to a fragrance (puts it on that product page), feature, hide, set the order; upload new films (MP4 up to 50 MB; the poster is taken from the video automatically). |
| Media library | Everything uploaded, with links and delete. |
| Subscribers | The newsletter list, with CSV download. |
| Settings | The admin team (add / remove by email), your password, and the go-live checklist. |

**Demo mode:** until Supabase is connected (or with `/admin?demo`), the panel runs in the browser
on a copy of the catalogue, so it can be tried safely. Nothing changes the live site.

**Security:** the database decides what each account may do (row-level security in
`supabase/schema.sql`). Only emails in the `admins` table can change anything. A signed-in
non-admin, or anyone with the public key, can only read the site and place orders. Uploads go to a
public `media` bucket that only admins can write to. `/admin` is kept out of search engines and
can't be framed.

### Going live (one time, about 10 minutes)

1. Supabase → **SQL Editor**: run `supabase/schema.sql`, then `supabase/seed.sql`. Both are safe
   to run again after updates.
2. In the SQL Editor, add the owner as the first admin:
   `insert into public.admins (email) values ('owner@example.com');`
3. Supabase → **Authentication → Users → Add user**: the same email and a password (tick
   "Auto confirm user"). Under **Authentication → Sign In / Providers**, turn off "Allow new
   users to sign up".
4. Supabase → **Project Settings → API Keys**: copy the **Publishable key**. In Vercel →
   **Settings → Environment Variables**, add these, then redeploy:
   - `VITE_SUPABASE_URL` = `https://unsrlrbbgjecswbswncc.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the key
5. Open `/admin`, sign in, and add the rest of the team under Settings (then create their users
   as in step 3).

From then on, products, prices, photos, copy and films edited in the panel show on the site as
soon as they're saved, with no redeploy. The bundled catalogue stays as the fallback if Supabase
is ever unreachable. Orders land in the `orders` table before the WhatsApp message is sent; the
public key can only place orders through `place_order`, which takes prices from the database.

**The spreadsheet after go-live:** it's still there for bulk loads (`npm run import:products`,
then run the new `seed.sql`). Prices typed in the sheet replace the panel's; empty cells keep
them. Photos, descriptions and featured flags set in the panel are never overwritten.

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
| III | Origins (`#story`, pinned) | The screen turns to sepia film and an odometer rewinds 2026 → 1986. The counter lands in "Established in 1986", then the real photograph of founder **Yasinali Sayed** at his counter drops in and develops. His name and story take over the panel, and his words *"Sugandh se rishte bante hain"* write themselves in script, signed. Colour then returns over a dusk skyline. |
| IV | The House Today (`#founder`) | **Liyaqat Sayed**, founder and owner of Raza Perfume today and Yasinali's son. His portrait sits in a wide Mughal arch beside incense smoke from a brass burner, and his quote lights up word by word as you scroll. |
| V | Collection (`#collection`, pinned) | The bottle spins through Base → Oud → Musk. Liquid, glass tint, label, splash colour and backdrop grade all change with it. |
| — | Promises / Journey | Line icons draw themselves. A giant RAZA rises from the footer and the gold follows the cursor. |

## Where to edit things

| What | File |
|------|------|
| All page copy | `index.html` (the editable blocks are listed in `src/cms/fields.js` and changed in `/admin`) |
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

- `public/media/yasinali-sayed-1986.jpg`: the founder, Yasinali Sayed, at the first Raza counter (Origins chapter).
- `public/media/liyaqat-sayed.jpg`: Liyaqat Sayed (Chapter IV, landscape, about 1.4:1).
  It appears inside the arch automatically. If the file is missing, a candle shows in its place.
- `public/media/anatomy.jpg` is only shown if a visitor's device can't run WebGL.

## Content to confirm with the client

- **Yasinali Sayed's "about"** (Origins chapter) is a draft written from his photograph. "Bombay" and the oud / musk / amber / rose / sandal blends come from the signage in that photo.
- **Liyaqat Sayed's "about"** (Chapter IV) is a draft. It presents him as founder and owner of Raza Perfume today, carrying forward what his father Yasinali began in 1986 (credited as "The first founder · Est. 1986"). His quote, "True luxury is not seen, it is felt.", comes from the original wireframe.
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
