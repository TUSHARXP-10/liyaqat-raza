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
| III | Origins (`#story`, pinned) | The screen turns to sepia film and an odometer rewinds 2026 → 1989. The counter lands in the title and the 1989 shop photograph develops. The founder's quote writes itself, then colour returns over a dusk skyline. |
| IV | Founder (`#founder`) | A candle-lit arch, incense smoke rising from a brass burner, and a quote that lights up word by word as you scroll. |
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

## Assets to supply

- **Founder portrait**: drop a photo at `public/media/founder.jpg` (portrait, about 1200×1680).
  It appears inside the arch automatically and replaces the candle placeholder.
- `public/media/anatomy.jpg` is only shown if a visitor's device can't run WebGL.

## Content to confirm with the client

- **Founder's name**: the wireframe reads "Silyakat". The site uses **Liyaqat** (from the project name).
  To change it, search `index.html` for `Liyaqat`.
- **Fragrance notes and descriptions** in the Collection chapter are placeholder copy written for the layout.
- **Timeline details**: "Estd. 1989" and "the first shop" come from the wireframe.
- Social links, the "Add to bag" counter and the newsletter form are front-end only. Connect them to the shop/CRM.

## Tech

Vite · Three.js (physical glass with transmission and dispersion, PMREM studio lighting) ·
GSAP (ScrollTrigger, SplitText, DrawSVG) · Lenis smooth scroll. No image or audio files are
needed. Everything is procedural, so it stays sharp at any resolution.

Performance: the pixel ratio is capped and steps down automatically if frames slow down. The canvas
stops rendering while it's off screen. Smoke only runs while visible, and `prefers-reduced-motion` disables smooth scrolling.
