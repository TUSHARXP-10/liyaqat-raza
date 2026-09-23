// The bottle's journey through the film. Each keyframe is anchored to a named
// ScrollTrigger range and progress (0–1 within it). Values cascade from the
// previous keyframe; `m` holds phone overrides.
//
// x / y are fractions of the half-viewport (so layouts scale with the screen),
// z is world depth, s is scale.

export const heroState = { variant: 0 };
const H = () => heroState.variant;
const TAU = Math.PI * 2;

export const KEYFRAMES = [
  // I · Prologue — hero, bottle stands right of the headline
  {
    at: ['hero', 0],
    d: { x: 0.36, y: -0.05, z: 0, rx: 0.03, ry: -0.42, rz: 0, s: 1.06, explode: 0, variant: H, splash: 1, halo: 1, opacity: 1, spin: 1, dust: 1 },
    m: { x: 0, y: -0.5, s: 0.5 },
  },
  { at: ['hero', 0.7], d: { x: 0.2, y: 0, ry: -0.05, s: 0.96, splash: 0.7 }, m: { x: 0, y: -0.16, s: 0.52 } },

  // II · Anatomy — centre stage, then pulled apart piece by piece
  { at: ['anatomy', 0], d: { x: 0, y: -0.03, rx: 0.05, ry: 0.45, s: 0.8, splash: 0.25, variant: 0, spin: 0.35 }, m: { x: 0, y: 0.02, s: 0.54 } },
  { at: ['anatomy', 0.2], d: { y: 0, ry: 0.62, s: 0.74, splash: 0, spin: 0.15, explode: 0 }, m: { s: 0.5, y: 0.04 } },
  { at: ['anatomy', 0.78], d: { explode: 1, s: 0.56, ry: -0.42, rx: 0.1, y: 0.03 }, m: { s: 0.34, y: 0.16 } },
  { at: ['anatomy', 0.88], d: { explode: 1, ry: -0.28 }, m: { s: 0.34, y: 0.16 } },
  { at: ['anatomy', 1], d: { explode: 0, s: 0.8, ry: 0, rx: 0.03, y: 0, halo: 1.5, spin: 0.4 }, m: { s: 0.54, y: 0.04 } },

  // III · Origins — the bottle recedes into the past
  { at: ['storyEnter', 0.15], d: { ry: 0.3, halo: 1 }, m: { s: 0.54 } },
  { at: ['storyEnter', 1], d: { z: -18, y: 0.3, s: 0.55, ry: 2.2, opacity: 0, halo: 0, dust: 0.3 }, m: { s: 0.4 } },

  // V · Collection — returns centre stage and transforms between fragrances
  { at: ['colEnter', 0], d: { x: 0, y: -1.3, z: 0, s: 0.9, ry: -1.4, rx: 0.02, opacity: 0, dust: 0.4, variant: 0, splash: 0, spin: 0.6 }, m: { y: -1.3, s: 0.46 } },
  { at: ['colEnter', 0.55], d: { opacity: 1 } },
  { at: ['collection', 0], d: { y: -0.06, s: 0.88, ry: -0.25, halo: 1, dust: 1, splash: 0.5 }, m: { y: 0.1, s: 0.46 } },
  { at: ['collection', 0.3], d: { ry: 0.2, variant: 0 }, m: { y: 0.1 } },
  { at: ['collection', 0.45], d: { ry: 0.2 + TAU, variant: 1 }, m: { y: 0.1 } },
  { at: ['collection', 0.62], d: { ry: 0.45 + TAU, variant: 1 }, m: { y: 0.1 } },
  { at: ['collection', 0.78], d: { ry: 0.2 + TAU * 2, variant: 2 }, m: { y: 0.1 } },
  { at: ['collection', 1], d: { ry: 0.4 + TAU * 2, variant: 2 }, m: { y: 0.1 } },

  // Exit — rises out of frame as the promises arrive
  { at: ['promise', 0.6], d: { y: 1.3, s: 0.7, ry: 1 + TAU * 2, opacity: 0, halo: 0, splash: 0, dust: 0.6 }, m: { y: 1.3 } },
];
