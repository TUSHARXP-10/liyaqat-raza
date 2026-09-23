import { clamp, lerp, damp, ease } from '../lib/math.js';

// The Director turns scroll position into a single "camera state" for the 3D
// bottle. Keyframes are pinned to ScrollTrigger ranges (e.g. 40% through the
// anatomy pin), inherit from the previous keyframe, and can carry mobile
// overrides. The result is damped so every move feels filmed, not scripted.

const KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'explode', 'variant', 'splash', 'halo', 'opacity', 'spin', 'dust'];
const DEFAULTS = {
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, explode: 0, variant: 0, splash: 0, halo: 1, opacity: 1, spin: 1, dust: 1,
};

export class Director {
  constructor(triggers, keyframes) {
    this.triggers = triggers;
    this.keyframes = keyframes;
    this.current = { ...DEFAULTS };
    this.target = { ...DEFAULTS };
    this.extra = { ry: 0 };
    this.primed = false;
    this.#resolve();
  }

  #resolve() {
    let d = { ...DEFAULTS };
    let m = { ...DEFAULTS };
    this.resolved = this.keyframes.map((kf) => {
      d = { ...d, ...kf.d };
      m = { ...m, ...kf.d, ...(kf.m || {}) };
      return { at: kf.at, d, m, pos: 0 };
    });
  }

  refresh() {
    let prev = 0;
    for (const kf of this.resolved) {
      const [name, p] = kf.at;
      const st = this.triggers[name];
      if (!st) console.warn(`[director] no trigger named "${name}"`);
      // keep the track monotonic even if a trigger is missing or misordered
      kf.pos = Math.max(prev, st ? st.start + p * (st.end - st.start) : prev);
      prev = kf.pos;
    }
  }

  sample(scroll, mobile) {
    const list = this.resolved;
    const key = mobile ? 'm' : 'd';
    let a = list[0], b = list[0], t = 0;
    if (scroll <= list[0].pos) {
      a = b = list[0];
    } else if (scroll >= list[list.length - 1].pos) {
      a = b = list[list.length - 1];
    } else {
      for (let i = 0; i < list.length - 1; i++) {
        if (scroll >= list[i].pos && scroll < list[i + 1].pos) {
          a = list[i];
          b = list[i + 1];
          t = ease.inOutSine(clamp((scroll - a.pos) / Math.max(1, b.pos - a.pos)));
          break;
        }
      }
    }
    const A = a[key], B = b[key];
    for (const k of KEYS) {
      const va = typeof A[k] === 'function' ? A[k]() : A[k];
      const vb = typeof B[k] === 'function' ? B[k]() : B[k];
      this.target[k] = lerp(va, vb, t);
    }
    return this.target;
  }

  update(scroll, dt, mobile) {
    const target = this.sample(scroll, mobile);
    const c = this.current;
    if (!this.primed) {
      Object.assign(c, target);
      this.primed = true;
    } else {
      for (const k of KEYS) c[k] = damp(c[k], target[k], k === 'opacity' ? 9 : 6.5, dt);
    }
    return { ...c, ry: c.ry + this.extra.ry };
  }
}
