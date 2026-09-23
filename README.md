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

## Deploy (Vercel)

The repo is Vercel-ready (`vercel.json`):

1. In Vercel choose **Add New → Project** and import `TUSHARXP-10/liyaqat-raza`.
2. Keep the detected settings (Framework **Vite**, build `npm run build`, output `dist`) and click **Deploy**.

Every push to `main` then redeploys automatically. Hashed build assets are cached for a year, and `/media` for a week.

## The story, chapter by chapter

| # | Chapter | What happens |
|---|---------|--------------|
| — | Preloader | "رضا" is written right-to-left in gold while real assets load. The visitor chooses *Enter with sound* or *Enter in silence*, then the curtain splits. |
| I | Prologue (`#hero`) | The bottle rises onto a marble plinth in a Moorish colonnade while liquid-gold ribbons pour around it. Slides 01/02/03 switch the headline and turn the bottle into Base, Oud or Musk. |
| II | Anatomy (`#anatomy`, pinned) | The bottle comes apart piece by piece: cap, R seal, spray, collar, glass, fragrance, base. Each label is attached to the actual 3D part and follows it. It then snaps back together. |
| III | Origins (`#story`, pinned) | The screen turns to sepia film and an odometer rewinds 2026 → 1986. The counter lands in "Established in 1986", then the real photograph of founder **Yasinali Sayyad** at his counter drops in and develops. His name and story take over the panel, and his words *"Sugandh se rishte bante hain"* write themselves in script, signed. Colour then returns over a dusk skyline. |
| IV | The House Today (`#founder`) | **Liyaqat & Yasmeen Sayyad**, founders and owners of Raza Perfume as it is today, presented together. Their portrait sits in a wide Mughal arch beside incense smoke from a brass burner, and their shared quote lights up word by word as you scroll. |
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

## Assets

- `public/media/yasinali-sayyad-1986.jpg`: the founder, Yasinali Sayyad, at the first Raza counter (Origins chapter).
- `public/media/liyaqat-yasmeen-sayyad.jpg`: Liyaqat & Yasmeen Sayyad (Chapter IV, landscape, about 1.4:1).
  It appears inside the arch automatically. If the file is missing, a candle shows in its place.
- `public/media/anatomy.jpg` is only shown if a visitor's device can't run WebGL.

## Content to confirm with the client

- **Yasinali Sayyad's "about"** (Origins chapter) is a draft written from his photograph. "Bombay" and the oud / musk / amber / rose / sandal blends come from the signage in that photo.
- **Liyaqat & Yasmeen Sayyad's "about"** (Chapter IV) is a draft. It presents them as equal partners and founders & owners of Raza Perfume today, carrying forward what Yasinali began in 1986 (he is credited as "The first founder · Est. 1986"). Their shared quote, "True luxury is not seen, it is felt.", comes from the original wireframe.
- **Fragrance notes and descriptions** in the Collection chapter are placeholder copy written for the layout.
- Social links, the "Add to bag" counter and the newsletter form are front-end only. Connect them to the shop/CRM.

## Tech

Vite · Three.js (physical glass with transmission and dispersion, PMREM studio lighting) ·
GSAP (ScrollTrigger, SplitText, DrawSVG) · Lenis smooth scroll. No image or audio files are
needed. Everything is procedural, so it stays sharp at any resolution.

Performance: the pixel ratio is capped and steps down automatically if frames slow down. The canvas
stops rendering while it's off screen. Smoke only runs while visible, and `prefers-reduced-motion` disables smooth scrolling.
