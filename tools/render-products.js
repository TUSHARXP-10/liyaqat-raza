// Studio renders of the Raza bottle for every shop product, with a transparent
// background. Driven by scripts/render-products.mjs; exposes window.renderProduct.
import * as THREE from 'three';
import { Bottle } from '../src/three/Bottle.js';
import { makeLabelTextures, makeCapTextures, makeCoinTextures, makeSwirlTexture } from '../src/three/textures.js';
import { studioEnvironment } from '../src/three/Stage.js';
import { createNoise } from '../src/lib/noise.js';
import { PRODUCTS, SIGNATURES } from '../src/shop/products.js';
import { VARIANTS } from '../src/content.js';
import { tintFor, labelFor } from '../src/shop/look.js';

const SIZE = 800;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
// same fix as the site: keep clear glass clear over a transparent background
const setClearColor = renderer.setClearColor.bind(renderer);
renderer.setClearColor = (c, a) => (c === 0xffffff && a === 0.5 ? setClearColor(0x000000, 0) : setClearColor(c, a));
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.environment = studioEnvironment(renderer);
scene.environmentRotation.y = 0.35;
const key = new THREE.DirectionalLight('#ffe2b0', 1.7);
key.position.set(-4, 6, 5);
const rim = new THREE.DirectionalLight('#ffb070', 2.2);
rim.position.set(4, 2.5, -5);
const fill = new THREE.DirectionalLight('#ffd9a8', 0.7);
fill.position.set(5, 0, 6);
scene.add(key, rim, fill, new THREE.AmbientLight('#3a2617', 0.8));

const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
camera.position.set(0, 0.36, 9.4);
camera.lookAt(0, 0.28, 0);

await Promise.all(['700 100px "Aref Ruqaa"', '400 100px Cinzel', '500 100px Cinzel'].map((f) => document.fonts.load(f, 'رضا RAZA')));

const noise = createNoise(1989);
const empty = { map: null, pbr: null };
const tex = {
  labels: await makeLabelTextures(VARIANTS.map((v) => v.name)),
  cap: makeCapTextures(),
  coin: makeCoinTextures(),
  swirl: makeSwirlTexture(noise),
  marble: { side: empty, top: empty },
};
const bottle = new Bottle(tex, noise);
bottle.parts.base.visible = false; // product shot: bottle only, no plinth
bottle.root.rotation.set(0.05, -0.45, 0);
bottle.update(4);
scene.add(bottle.root);

const all = [...PRODUCTS, ...SIGNATURES];

window.renderProduct = async (id) => {
  const p = all.find((x) => x.id === id);
  if (!p) throw new Error(`unknown product ${id}`);
  let temp = null;
  bottle.labelIndex = -1;
  if (p.category === 'house') {
    bottle.setVariant(p.number - 1);
  } else {
    bottle.setVariant(0);
    const tint = new THREE.Color(tintFor(p));
    bottle.mat.liquid.color.copy(tint);
    bottle.mat.liquid.emissive.copy(tint).multiplyScalar(0.42);
    temp = (await makeLabelTextures([labelFor(p)]))[p.id];
    Object.assign(bottle.mat.label, { map: temp.map, emissiveMap: temp.map, roughnessMap: temp.pbr, metalnessMap: temp.pbr });
    bottle.mat.label.needsUpdate = true;
  }
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/webp', 0.86);
  temp?.map.dispose();
  temp?.pbr.dispose();
  return url;
};

window.productIds = all.map((p) => p.id);
window.ready = true;
