import * as THREE from 'three';
import { Bottle } from './Bottle.js';
import { Splash } from './Splash.js';
import { Dust } from './Dust.js';
import {
  makeLabelTextures, makeCapTextures, makeCoinTextures, makeMarbleTextures, makeSwirlTexture, makeGlowTexture,
} from './textures.js';
import { createNoise } from '../lib/noise.js';
import { VARIANTS } from '../content.js';
import { clamp, damp } from '../lib/math.js';

const FOV = 28;
const CAM_Z = 12;

// A warm product-photography studio, baked to a PMREM so glass and gold
// pick up long softbox reflections instead of a generic room.
// The site loads a pre-baked copy (public/media/env/studio.hdr, made by
// `npm run bake:env`) because generating it live blocks the GPU.
export function studioEnvironmentTarget(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c0805'), side: THREE.BackSide }),
  ));
  const panel = (w, h, color, intensity, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(12, 3.5, '#fff0d4', 5.5, [0, 10, 2]);
  panel(1.8, 14, '#ffd49a', 4.5, [-9, 0, 3]);
  panel(1.4, 14, '#ffe6c2', 3.4, [9, 1, 0.5]);
  panel(8, 8, '#ff9a4a', 0.45, [0, -1, -11]);
  panel(3, 1.5, '#fff4e2', 1.2, [5, 4, 11]);
  panel(16, 2, '#b86a22', 1.1, [0, -9, 1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  return target;
}

export const studioEnvironment = (renderer) => studioEnvironmentTarget(renderer).texture;

// Loads the baked studio environment (already in PMREM "cube UV" layout).
async function loadStudioEnvironment() {
  const { HDRLoader } = await import('three/addons/loaders/HDRLoader.js');
  const tex = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${import.meta.env.BASE_URL}media/env/studio.hdr`);
  tex.mapping = THREE.CubeUVReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    const r = this.renderer;
    // Three fills the transmission buffer with 50% white when the canvas is
    // transparent, which turns clear glass milky over our dark backdrop.
    // Swap that fill for transparent black so the crystal stays crystal.
    const setClearColor = r.setClearColor.bind(r);
    r.setClearColor = (color, alpha) =>
      color === 0xffffff && alpha === 0.5 ? setClearColor(0x000000, 0) : setClearColor(color, alpha);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.transmissionResolutionScale = 0.75;
    // shader-log queries force the driver to finish compiling synchronously
    r.debug.checkShaderErrors = Boolean(import.meta.env.DEV);
    this.hold = true; // no frames until the intro hands over

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.intro = 0;
    this.dustScroll = 0;
    this.visible = true;
    this.mobile = window.innerWidth < 820;
    this._v = new THREE.Vector3();
    // adaptive quality: step the pixel ratio down, then the glass effects,
    // whenever frames run slow. Weak phones start one step down.
    this.prCap = 2;
    this.quality = 0;
    this.perf = { acc: 0, frames: 0, windows: 0 };
    const mem = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    this.lowEnd = this.mobile && (mem <= 4 || cores <= 4);
    if (this.lowEnd) this.prCap = 1.25;
  }

  // 1: no colour dispersion, cheaper refraction · 2: coarser refraction, no bokeh
  #lighten(level) {
    if (level <= this.quality || !this.bottle) return;
    this.quality = level;
    const m = this.bottle.mat;
    if (level >= 1) {
      for (const mat of [m.glass, m.crystal, m.vessel]) mat.dispersion = 0;
      this.renderer.transmissionResolutionScale = 0.5;
    }
    if (level >= 2) {
      this.renderer.transmissionResolutionScale = 0.35;
      this.dust.bokeh.visible = false;
    }
  }

  #monitor(dt) {
    const p = this.perf;
    p.acc += dt;
    p.frames += 1;
    if (p.acc < 1.5) return;
    const avg = p.acc / p.frames;
    p.acc = 0;
    p.frames = 0;
    p.windows += 1;
    if (p.windows <= 2 || avg <= 1 / 45) return;
    if (this.prCap > 1) {
      this.prCap = Math.max(1, Math.min(this.renderer.getPixelRatio(), this.prCap) - 0.25);
      this.resize();
    } else if (this.quality < 2) {
      this.#lighten(this.quality + 1);
    }
  }

  async load(onProgress = () => {}) {
    // fetch + decode the baked environment alongside the texture painting
    const envPromise = loadStudioEnvironment().catch((err) => {
      console.warn('[raza] baked environment unavailable, generating it live', err);
      return null;
    });
    const noise = createNoise(1989);
    const labels = await makeLabelTextures(VARIANTS.map((v) => v.name));
    onProgress(0.12);
    const cap = makeCapTextures();
    const coin = makeCoinTextures();
    onProgress(0.2);
    const swirl = makeSwirlTexture(noise);
    onProgress(0.26);
    const marble = await makeMarbleTextures(1989, (p) => onProgress(0.26 + p * 0.56));
    const glow = makeGlowTexture();
    this.tex = { labels, cap, coin, swirl, marble, glow };

    this.scene.environment = (await envPromise) ?? studioEnvironment(this.renderer);
    this.scene.environmentIntensity = 1;

    const key = new THREE.DirectionalLight('#ffe2b0', 1.6);
    key.position.set(-4, 6, 5);
    const rim = new THREE.DirectionalLight('#ffb070', 1.9);
    rim.position.set(4, 2.5, -5);
    const under = new THREE.DirectionalLight('#ffb866', 0.8);
    under.position.set(0, -4, 4);
    this.scene.add(key, rim, under, new THREE.AmbientLight('#3a2617', 0.8));

    this.bottle = new Bottle(this.tex, noise);
    this.splash = new Splash(noise.rand);
    this.bottle.root.add(this.splash.group);
    this.splash.group.position.y = 1.05 - 1.27;

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: '#ff9a3a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5,
    }));
    this.halo.scale.set(8, 8, 1);
    this.halo.position.set(0, 0.2, -2.2);
    this.bottle.root.add(this.halo);

    this.scene.add(this.bottle.root);
    this.dust = new Dust(noise.rand, this.mobile);
    this.scene.add(this.dust.group);
    if (this.lowEnd) this.#lighten(1);

    this.resize();
    onProgress(0.88);
    // Compile every shader before the first frame, in the background
    // (KHR_parallel_shader_compile): a program used before it's ready makes
    // the browser wait for the GPU driver, which freezes everything.
    //  · with the bottle exploded, so the coin/vessel variants are included
    //  · once for the screen and once for an offscreen target: the glass
    //    refraction pass renders into a texture without tone mapping, which
    //    needs its own shader variants
    this.bottle.setExplode(1);
    await this.renderer.compileAsync(this.scene, this.camera);
    onProgress(0.94);
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
    this.renderer.setRenderTarget(target);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    target.dispose();
    this.bottle.setExplode(0);
    onProgress(1);
  }

  // Uploads textures one per frame, then draws the first real frames
  // (exploded + assembled) so the first scroll never hitches. Runs while the
  // intro still covers the screen.
  async warm() {
    if (!this.bottle) return;
    const textures = new Set();
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) {
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
    });
    if (this.scene.environment) textures.add(this.scene.environment);
    for (const tex of textures) {
      this.renderer.initTexture(tex);
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.bottle.setExplode(1);
    this.renderer.render(this.scene, this.camera);
    await new Promise((r) => requestAnimationFrame(r));
    this.bottle.setExplode(0);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.mobile = w < 820;
    const pr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 1.75, this.prCap);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dust?.setPixelRatio(pr);
    this.halfH = Math.tan((FOV / 2) * (Math.PI / 180)) * CAM_Z;
    this.halfW = this.halfH * this.camera.aspect;
    // squarer desktop screens: shrink a touch so compositions keep breathing room
    this.fit = this.mobile ? 1 : clamp(this.camera.aspect / 1.6, 0.72, 1);
    this.size = { w, h };
  }

  setPointer(nx, ny) {
    this.mouse.x = nx;
    this.mouse.y = ny;
  }

  update(state, time, dt, scrollVelocity) {
    if (!this.bottle) return;
    const m = this.mouse;
    m.sx = damp(m.sx, m.x, 3, dt);
    m.sy = damp(m.sy, m.y, 3, dt);

    const opacity = clamp(state.opacity);
    this.visible = opacity > 0.004;
    this.canvas.style.opacity = opacity.toFixed(3);
    if (!this.visible) return;
    this.#monitor(dt);

    const cam = this.camera;
    cam.position.x = m.sx * 0.35;
    cam.position.y = -m.sy * 0.2;
    cam.lookAt(0, 0, 0);

    const intro = this.intro;
    const root = this.bottle.root;
    const sway = Math.sin(time * 0.35) * 0.14 * state.spin;
    root.position.set(state.x * this.halfW, state.y * this.halfH - (1 - intro) * 2.6, state.z);
    root.rotation.set(
      state.rx + Math.sin(time * 0.5) * 0.02 * state.spin + m.sy * 0.05,
      state.ry + sway + m.sx * 0.14 + (1 - intro) * -1.2,
      state.rz,
    );
    root.scale.setScalar(state.s * this.fit * (0.82 + 0.18 * intro));

    this.bottle.setExplode(state.explode);
    this.bottle.setVariant(state.variant);
    this.bottle.update(time);

    const v0 = VARIANTS[Math.floor(clamp(state.variant, 0, 2))];
    const v1 = VARIANTS[Math.min(2, Math.floor(clamp(state.variant, 0, 2)) + 1)];
    const f = state.variant - Math.floor(state.variant);
    this._c1 ??= new THREE.Color();
    this._c2 ??= new THREE.Color();
    this._c1.set(v0.ribbon).lerp(this._c2.set(v1.ribbon), f);
    this._c2.copy(this._c1).multiplyScalar(0.32);
    this.splash.setColor(this._c1, this._c2);
    this.splash.update(time, state.splash * intro);

    this.halo.material.opacity = state.halo * 0.42 * intro;
    this.halo.material.color.copy(this._c1).lerp(new THREE.Color('#ff8a2a'), 0.5);

    this.dustScroll += scrollVelocity * 0.0009;
    this.dust.update(time, this.dustScroll, state.dust);

    this.scene.environmentRotation.y = time * 0.06;
    this.scene.updateMatrixWorld();
  }

  render() {
    if (this.visible && this.bottle) this.renderer.render(this.scene, this.camera);
  }

  // World-space anchor -> CSS pixels
  project(anchor) {
    const v = this._v.copy(anchor.local);
    anchor.obj.localToWorld(v);
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h };
  }

  projectPoint(worldVec) {
    const v = this._v.copy(worldVec).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h };
  }
}
