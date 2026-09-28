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
- **Photos:** real photos come first, one folder per kind, then run `npm run import:photos`:
  - `product image/`: **perfume** photos, shown when the customer picks Perfume (and on every
    card until they pick Attar on it).
  - `attar image/`: **attar** photos, shown when the customer picks Attar. `Attar bottles.jpg`,
    `Attar bottles 2.jpg` … (no fragrance name) are the general attar photos, shown with Attar for
    every fragrance that has no attar photo of its own.
  - `product image/Perfume bottles.jpg`, `Perfume bottles 2.jpg` …: Raza house bottles with no
    fragrance name, shown with Perfume for every fragrance that has no photo of its own (marked
    "Shown in a Raza house bottle" in quick view and on the product page). Neighbouring cards
    never share one. Several are stills from the shop's own films.

  Name each after the fragrance (`Gucci Oud.jpg`, `raza_perfume_cool_water.jpg`; a second photo
  ends in a number or `_alt`; a designed notes card has "notes" in its name, is never cropped and
  shows with both kinds). Each is made square as WebP in three sizes (large, card, thumbnail) plus
  a JPEG for link previews; tall phone shots sit on a blurred copy of themselves, with the camera
  watermark strip cropped off. The photos of the kind picked show on the card, in quick view, on
  the product page and in the bag. In the admin panel each photo has a "Shows with" tag
  (Perfume & Attar, Perfume, Attar). Photos whose name isn't in the spreadsheet are kept and
  reported, and attach once the sheet lists that fragrance. Only the three house signatures keep
  the studio render from `public/media/products/`. `image_url` in Supabase overrides both.

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

After the first deploy, in the Vercel project:

- **Analytics → Enable** (Web Analytics) and **Speed Insights → Enable**. The site loads both only
  for visitors who tap "Allow" in the privacy notice; until they are enabled the scripts simply
  don't run.

**Live domain: https://www.razaperfume.com** (Vercel project `liyaqat-raza-15nd`). DNS is at
Hostinger: `A @ 216.198.79.1` and `CNAME www cname.vercel-dns.com`; Vercel redirects
`razaperfume.com` to `www` and renews the HTTPS certificates itself. The sitemap, canonical links
and link previews use `https://www.razaperfume.com` (`vite.config.js`; `SITE_URL` overrides it).

**Database:** Supabase project `supabase-bronze-cave` (`jxufcqcvfnfmhuhnojfq`). The site reads its
URL and publishable key from `.env.production`. Set up with `supabase/setup.sql`; admins are
listed in `public.admins`. In Supabase → Authentication → URL Configuration, the Site URL is the
live domain and `https://www.razaperfume.com/admin` is an allowed redirect (password resets).

## Launch checklist (what's in place)

| Item | Where |
|------|-------|
| Privacy policy · Terms & conditions | `/privacy`, `/terms` (from `legal/privacy.md`, `legal/terms.md`, rendered like `/license` by `scripts/license-page.mjs`); linked from every footer and the order form |
| No secrets in the frontend | Only the Supabase URL and publishable key reach the browser (public by design; the database is protected by row-level security). No keys or passwords are in the repo or its history |
| HTTPS | Vercel redirects HTTP → HTTPS; `Strict-Transport-Security`, `upgrade-insecure-requests`, `frame-ancestors 'self'`, `Permissions-Policy` in `vercel.json` |
| Cookie consent | `src/ui/consent.js`: no tracking cookies; anonymous analytics only after "Allow"; "No thanks" is remembered; the choice can be reset on `/privacy` |
| Analytics | Vercel Web Analytics + Speed Insights (cookieless), gated by the notice |
| Meta titles/descriptions, social preview | Every page; each product page has its own title, description and photo (JPEG) for link previews |
| Favicon | `favicon.ico`, PNG icons, `site.webmanifest` |
| Sitemap, robots.txt | Generated at build: home, Blogs, every product, Privacy, Terms |
| Images | WebP in three sizes (thumbnails, cards, large views), lazy-loaded, every image has alt text |
| Speed | Fonts load without blocking; the Raza mark paints immediately while the intro loads |
| Contrast, mobile, 404 | Small print lightened to ≥4.5:1; no sideways scrolling at 360–1440 px; custom 404 page |
| Links | Every internal link checked; `/license` etc. linked directly (no redirects) |
| Forms | The order form checks name (letters), phone (digits, 7–15) and city; the newsletter checks the email. Errors are announced and the field marked |
| Spam protection | A hidden honeypot field in both forms; the database also validates everything and rate-limits orders (3 per phone per 10 minutes, 30 a minute) and sign-ups (20 a minute) |
| One clear call to action | The opening screen leads with **Shop 145 fragrances**; the story is the quiet alternative |

## The story, chapter by chapter

| # | Chapter | What happens |
|---|---------|--------------|
| — | Title sequence (`src/ui/intro.js`, ~7.7 s) | The site loads during the sequence. Gold particles spiral in and form the Raza logo, a light sweep crosses it, then a black hole opens and swallows it. After a flash: "Since 1986 · razaperfume.com", then the license credit for Webzoo Innovation, and the curtain opens. It has Skip and a sound toggle, and plays on every page load, refreshes included. Only `?skip` (for development) goes straight in. |
| I | Prologue (`#hero`) | The bottle rises onto a marble plinth in a Moorish colonnade while liquid-gold ribbons pour around it. Slides 01/02/03 switch the headline and turn the bottle into Base, Oud or Musk. |
| II | Anatomy (`#anatomy`, pinned) | The bottle comes apart piece by piece: cap, R seal, spray, collar, glass, fragrance, base. Each label is attached to the actual 3D part and follows it. It then snaps back together. |
| III | Origins (`#story`, pinned 5.3 screens) | The screen turns to sepia film and an odometer rewinds 2026 → 1986. The counter lands in "Established in 1986" with the Raza story. Then **1984 · Kannauj, where the craft began**: Yasinali's training at the Fragrance & Flavour Development Centre (FFDC Kannauj) and three skills, beside a print whose etching of a deg-and-bhapka still draws itself line by line. Next, the real photograph of founder **Yasinali Sayed** at his counter lands over that print and develops. His name and story take over the panel, and his words *"Sugandh se rishte bante hain"* write themselves in script, signed. Colour then returns over a dusk skyline. Beats are placed in screens of scroll (`STORY_SCREENS` in `chapters.js`). |
| IV | The House Today (`#founder`, `#cofounder`) | **Liyaqat Sayed**, founder and owner of Raza Perfume today and Yasinali's son. His portrait at the Raza counter sits in a tall Mughal arch (3:4) beside incense smoke from a brass burner, and his quote lights up word by word as you scroll. "Meet our co-founder" leads on to **Amjad Ali Sayed**, co-founder and partner: the same arch reveal, mirrored (copy left, arch right), in a 2:3 arch the same height as Liyaqat's. The chapter rail stays on IV for both. |
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

- `public/media/yasinali-sayed-1986.webp`: the founder, Yasinali Sayed, at the first Raza counter (Origins chapter).
- `public/media/liyaqat-sayed-shop.webp`: Liyaqat Sayed at the Raza counter (Chapter IV, portrait
  3:4, in a tall arch). To change it, add the new photo under a new file name and point
  `index.html` at it: `/media/` files are cached for a week, so reusing a name can show the old photo.
  It appears inside the arch automatically. If the file is missing, a candle shows in its place.
- `public/media/amjad-ali-sayed-portrait.webp`: Amjad Ali Sayed, co-founder (Chapter IV, portrait 2:3).
  Same rule: a new photo gets a new file name.
- The Kannauj etching (deg and bhapka) is inline SVG in `index.html`, drawn for the site.
- `public/media/anatomy.jpg` is only shown if a visitor's device can't run WebGL.

## Content to confirm with the client

- **Yasinali Sayed's "about"** (Origins chapter) is a draft written from his photograph. "Bombay" and the oud / musk / amber / rose / sandal blends come from the signage in that photo.
- **Liyaqat Sayed's "about"** (Chapter IV) is a draft. It presents him as founder and owner of Raza Perfume today, carrying forward what his father Yasinali began in 1986 (credited as "The first founder · Est. 1986"). His quote, "True luxury is not seen, it is felt.", comes from the original wireframe.
- **The Kannauj scene** (Origins) is a draft: the training text and its three skills. The client
  gave 1984 as the year of his training. FFDC Kannauj itself was set up in 1991, so the text dates
  his going to Kannauj (1984) and names FFDC without a year. Edit it under Site content →
  "Origins · The craft, Kannauj".
- **Amjad Ali Sayed's "about"** (Chapter IV) is a draft: co-founder and Liyaqat's partner, with no
  family relation stated. Edit it under Site content → "The House Today · Amjad Ali Sayed".
- **Fragrance notes and descriptions** in the Collection chapter are placeholder copy written for the layout.
- **Privacy policy and Terms** (`legal/`) are written for how the site works today. Have the client
  confirm the business details in the Terms: delivery across India, the 48-hour window for damaged
  or wrong items, and Kalyan / Thane courts. Neither is a substitute for a lawyer's review.
- **House bottle photos**: fragrances without a photo of their own show a Raza house bottle, marked
  "Shown in a Raza house bottle". Add their own photos to `product image/` as they are taken.
- The newsletter stores emails once Supabase is connected; until then it points to Instagram.

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
