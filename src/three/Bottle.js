import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { VARIANTS } from '../content.js';
import { clamp, ease } from '../lib/math.js';

// Model space: bottle body sits on y = 0, pedestal below, cap on top.
// Every part is its own group so the "anatomy" chapter can pull the bottle
// apart piece by piece. Offsets and delays are tuned so parts never collide.

const MODEL_CENTER_Y = 1.27;

function octagon(rTop, rBottom, h) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 8, 1, false, -Math.PI / 8).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function faceted(rTop, rBottom, h, sides) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, sides, 1, false, -Math.PI / sides).toNonIndexed();
  g.computeVertexNormals();
  return g;
}

function lathe(profile, segments = 64) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function rockGeometry(noise, seed, sx, sy, sz) {
  let g = new THREE.IcosahedronGeometry(1, 5);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise.fbm3(v.x * 1.3 + seed, v.y * 1.3, v.z * 1.3, 5);
    const ridge = Math.abs(noise.noise3(v.x * 3 + seed, v.y * 3, v.z * 3)) * 0.18;
    v.multiplyScalar(1 + n * 0.55 - ridge);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < -sy * 0.35) v.y = -sy * 0.35 + (v.y + sy * 0.35) * 0.15;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class Bottle {
  constructor(tex, noise) {
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.model.position.y = -MODEL_CENTER_Y;
    this.root.add(this.model);
    this.tex = tex;

    this.colors = {
      liquid: new THREE.Color(),
      glow: new THREE.Color(),
      glass: new THREE.Color(),
      tmpA: new THREE.Color(),
      tmpB: new THREE.Color(),
    };

    this.#materials();
    this.#build(noise);
    this.labelIndex = -1;
    this.setVariant(0);
    this.setExplode(0);
  }

  #materials() {
    const t = this.tex;
    this.mat = {
      gold: new THREE.MeshPhysicalMaterial({ color: '#e0ad58', metalness: 1, roughness: 0.2 }),
      goldSoft: new THREE.MeshPhysicalMaterial({ color: '#d9a552', metalness: 1, roughness: 0.34 }),
      black: new THREE.MeshPhysicalMaterial({
        color: '#060504', metalness: 0.1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 1, thickness: 1.1, ior: 1.52,
        specularIntensity: 1, envMapIntensity: 1.5, dispersion: 0.3,
        attenuationColor: new THREE.Color('#fff4df'), attenuationDistance: 4,
      }),
      vessel: new THREE.MeshPhysicalMaterial({
        color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.5, ior: 1.5,
        envMapIntensity: 1.6, dispersion: 0.4,
      }),
      crystal: new THREE.MeshPhysicalMaterial({
        color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.5, ior: 1.6,
        envMapIntensity: 1.8, dispersion: 0.6,
      }),
      liquid: new THREE.MeshPhysicalMaterial({
        color: '#c9761a', metalness: 0.1, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1,
        emissive: '#7a3c05', emissiveMap: t.swirl, emissiveIntensity: 0.9, envMapIntensity: 0.55,
      }),
      label: new THREE.MeshPhysicalMaterial({
        roughness: 1, metalness: 1, emissive: '#ffffff', emissiveIntensity: 0.1,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }),
      capSide: new THREE.MeshPhysicalMaterial({
        map: t.cap.side.map, roughnessMap: t.cap.side.pbr, metalnessMap: t.cap.side.pbr,
        bumpMap: t.cap.side.bump, bumpScale: 1.4, roughness: 1, metalness: 1,
        clearcoat: 0.35, clearcoatRoughness: 0.2,
      }),
      capTop: new THREE.MeshPhysicalMaterial({
        map: t.cap.top.map, roughnessMap: t.cap.top.pbr, metalnessMap: t.cap.top.pbr,
        bumpMap: t.cap.top.bump, bumpScale: 1.4, roughness: 1, metalness: 1,
      }),
      coinTop: new THREE.MeshPhysicalMaterial({
        map: t.coin.map, roughnessMap: t.coin.pbr, metalnessMap: t.coin.pbr,
        bumpMap: t.coin.bump, bumpScale: 2, roughness: 1, metalness: 1,
      }),
      marbleSide: new THREE.MeshPhysicalMaterial({
        map: t.marble.side.map, roughnessMap: t.marble.side.pbr, metalnessMap: t.marble.side.pbr,
        roughness: 1, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.6,
      }),
      marbleTop: new THREE.MeshPhysicalMaterial({
        map: t.marble.top.map, roughnessMap: t.marble.top.pbr, metalnessMap: t.marble.top.pbr,
        roughness: 1, metalness: 1, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.45,
      }),
      rock: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.88, metalness: 0.08 }),
    };
  }

  #build(noise) {
    const m = this.mat;
    const P = (this.parts = {});
    const add = (key, obj, y, explode) => {
      obj.position.y = y;
      obj.userData.baseY = y;
      obj.userData.explode = explode;
      this.model.add(obj);
      P[key] = obj;
      return obj;
    };

    // Pedestal: octagonal black-and-gold marble on a bed of oud-wood rocks
    const pedestal = new THREE.Group();
    const plinth = new THREE.Mesh(octagon(1.5, 1.55, 0.7), [m.marbleSide, m.marbleTop, m.black]);
    plinth.position.y = -0.35;
    pedestal.add(plinth);
    const trim = new THREE.Mesh(octagon(1.51, 1.51, 0.03), m.goldSoft);
    trim.position.y = -0.005;
    pedestal.add(trim);
    const rockSpec = [
      [-1.55, -0.78, 0.35, 1.25, 0.42, 0.9, 0.3],
      [1.6, -0.8, 0.2, 1.35, 0.45, 0.95, -0.4],
      [0.1, -0.88, 0.95, 1.8, 0.35, 0.7, 0.1],
      [-0.4, -0.86, -0.9, 1.9, 0.4, 0.9, 0.9],
      [2.35, -0.95, -0.4, 0.8, 0.28, 0.7, 1.2],
      [-2.4, -0.97, -0.2, 0.9, 0.3, 0.6, -1.1],
    ];
    rockSpec.forEach(([x, y, z, sx, sy, sz, ry], i) => {
      const rock = new THREE.Mesh(rockGeometry(noise, i * 7.1, sx, sy, sz), m.rock);
      rock.position.set(x, y, z);
      rock.rotation.y = ry;
      pedestal.add(rock);
    });
    add('base', pedestal, 0, { y: -1.9, delay: 0.45 });

    // Fragrance: the liquid core. In the anatomy it slides out and flattens
    const liquid = new THREE.Mesh(new RoundedBoxGeometry(1.44, 1.64, 0.76, 5, 0.1), m.liquid);
    add('fragrance', liquid, 1.08, { y: -1.6, delay: 0.37, squash: 0.5 });
    // once it leaves the bottle the essence is shown sealed in its own crystal slab
    this.vessel = new THREE.Mesh(new RoundedBoxGeometry(1.64, 1.9, 0.98, 5, 0.18), m.vessel);
    this.vessel.visible = false;
    liquid.add(this.vessel);

    // Bottle: thick crystal body + label
    const body = new THREE.Group();
    const glass = new THREE.Mesh(new RoundedBoxGeometry(1.7, 2.1, 1.0, 7, 0.14), m.glass);
    body.add(glass);
    this.label = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.343), m.label);
    this.label.position.set(0, -0.04, 0.503);
    body.add(this.label);
    add('bottle', body, 1.05, { y: 0, delay: 0.3 });

    // Collar: faceted crystal ring
    const collar = new THREE.Group();
    const ring = new THREE.Mesh(faceted(0.36, 0.42, 0.24, 12), m.crystal);
    collar.add(ring);
    add('collar', collar, 2.22, { y: 0.6, delay: 0.22 });

    // Spray: neck, crimped ferrule, actuator with nozzle
    const spray = new THREE.Group();
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 32), m.black);
    neck.position.y = 0.08;
    spray.add(neck);
    const ferrule = new THREE.Mesh(
      lathe([[0, 0], [0.24, 0], [0.27, 0.025], [0.27, 0.07], [0.255, 0.085], [0.27, 0.1], [0.27, 0.175], [0.24, 0.2], [0.17, 0.2], [0.17, 0.22], [0, 0.22]]),
      m.gold,
    );
    ferrule.position.y = 0.12;
    spray.add(ferrule);
    const actuator = new THREE.Mesh(
      lathe([[0, 0], [0.19, 0], [0.21, 0.02], [0.21, 0.27], [0.195, 0.305], [0.12, 0.315], [0, 0.315]]),
      m.gold,
    );
    actuator.position.y = 0.34;
    spray.add(actuator);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 24), m.black);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.56, 0.205);
    spray.add(nozzle);
    add('spray', spray, 2.34, { y: 1.15, delay: 0.14 });

    // Coin: the gold "R" seal hidden inside the cap
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 72), [m.gold, m.coinTop, m.gold]);
    add('coin', coin, 3.02, { y: 1.5, delay: 0.06, tilt: 1.15 });

    // Cap: octagonal block — engraved gold faces, black lacquer diagonals
    const cap = new THREE.Group();
    const band = new THREE.Mesh(octagon(0.735, 0.735, 0.05), m.gold);
    band.position.y = 0.025;
    cap.add(band);
    const block = new THREE.Mesh(octagon(0.7, 0.72, 0.66), [m.capSide, m.capTop, m.black]);
    block.position.y = 0.38;
    cap.add(block);
    const chamfer = new THREE.Mesh(octagon(0.56, 0.7, 0.1), [m.gold, m.capTop, m.gold]);
    chamfer.position.y = 0.76;
    cap.add(chamfer);
    add('cap', cap, 2.34, { y: 2.6, delay: 0, tilt: 0.32 });

    // label anchor points (in each part's local frame) for the anatomy callouts
    this.anchors = [
      { key: 'cap', obj: cap, local: new THREE.Vector3(-0.72, 0.42, 0), side: 'left' },
      { key: 'spray', obj: spray, local: new THREE.Vector3(0.27, 0.24, 0), side: 'right' },
      { key: 'collar', obj: collar, local: new THREE.Vector3(-0.42, 0, 0), side: 'left' },
      { key: 'bottle', obj: body, local: new THREE.Vector3(0.85, 0.25, 0), side: 'right' },
      { key: 'fragrance', obj: liquid, local: new THREE.Vector3(-0.72, 0, 0), side: 'left' },
      { key: 'base', obj: pedestal, local: new THREE.Vector3(1.52, -0.35, 0), side: 'right' },
    ];
    this.partProgress = { cap: 0, spray: 0, collar: 0, bottle: 0, fragrance: 0, base: 0, coin: 0 };
  }

  setExplode(e) {
    this.explode = e;
    for (const [key, obj] of Object.entries(this.parts)) {
      const cfg = obj.userData.explode;
      const k = ease.inOutCubic(clamp((e - cfg.delay) / 0.5));
      this.partProgress[key] = k;
      obj.position.y = obj.userData.baseY + cfg.y * k;
      if (cfg.tilt) obj.rotation.x = cfg.tilt * k;
      if (cfg.squash) {
        obj.scale.y = 1 - (1 - cfg.squash) * k;
        obj.scale.x = obj.scale.z = 1 - 0.08 * k;
      }
    }
    // the cap drifts round a little so the engraved diagonals catch the light
    this.parts.cap.rotation.y = this.partProgress.cap * 0.55;
    // freed from the glass, the fragrance turns into polished, glowing amber
    const f = this.partProgress.fragrance;
    const liq = this.mat.liquid;
    liq.roughness = 0.18 - 0.12 * f;
    liq.clearcoat = 0.6 + 0.4 * f;
    liq.emissiveIntensity = 0.9 + 0.7 * f;
    liq.envMapIntensity = 0.55 + 0.6 * f;
    this.vessel.visible = f > 0.88;
    this.vessel.scale.setScalar(0.9 + 0.1 * clamp((f - 0.88) / 0.12));
    this.parts.coin.visible = e > 0.02;
  }

  setVariant(v) {
    const i0 = Math.floor(clamp(v, 0, VARIANTS.length - 1));
    const i1 = Math.min(VARIANTS.length - 1, i0 + 1);
    const f = clamp(v - i0);
    const a = VARIANTS[i0], b = VARIANTS[i1];
    const { liquid, glow, glass, tmpA, tmpB } = this.colors;
    liquid.copy(tmpA.set(a.liquid)).lerp(tmpB.set(b.liquid), f);
    glow.copy(tmpA.set(a.liquidGlow)).lerp(tmpB.set(b.liquidGlow), f);
    glass.copy(tmpA.set(a.glass)).lerp(tmpB.set(b.glass), f);
    this.mat.liquid.color.copy(liquid);
    this.mat.liquid.emissive.copy(glow);
    this.mat.glass.color.copy(glass);

    const idx = Math.round(clamp(v, 0, VARIANTS.length - 1));
    if (idx !== this.labelIndex) {
      this.labelIndex = idx;
      const lt = this.tex.labels[VARIANTS[idx].name];
      Object.assign(this.mat.label, { map: lt.map, emissiveMap: lt.map, roughnessMap: lt.pbr, metalnessMap: lt.pbr });
      this.mat.label.needsUpdate = true;
    }
  }

  update(time) {
    const sw = this.tex.swirl;
    sw.offset.set(time * 0.018, time * 0.031);
  }
}
