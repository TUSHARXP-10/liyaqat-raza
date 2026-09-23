import * as THREE from 'three';
import { clamp, ease } from '../lib/math.js';

// Liquid-gold ribbons that coil round the bottle, plus suspended droplets.
// Ribbons are tapered tubes "poured" by growing their draw range.

const TUBE_SEGMENTS = 200;
const RADIAL_SEGMENTS = 10;

const RIBBONS = [
  { a0: -2.75, sweep: 1.85, y0: -0.95, dy: 1.55, rx: 1.3, rz: 0.95, r: 0.075, seed: 0.3 },
  { a0: 2.65, sweep: -1.75, y0: 1.05, dy: -1.45, rx: 1.32, rz: 0.95, r: 0.068, seed: 1.7 },
  { a0: -1.35, sweep: -1.15, y0: 0.95, dy: 0.4, rx: 1.48, rz: 1.02, r: 0.05, seed: 2.9 },
  { a0: 1.45, sweep: 1.05, y0: -0.55, dy: 0.45, rx: 1.58, rz: 1.1, r: 0.045, seed: 4.2 },
];

function ribbonGeometry(spec) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const a = spec.a0 + spec.sweep * t;
    const swell = 1 + 0.22 * Math.sin(t * Math.PI) + 0.06 * Math.sin(t * 9 + spec.seed);
    pts.push(new THREE.Vector3(
      Math.sin(a) * spec.rx * swell,
      spec.y0 + spec.dy * t + 0.2 * Math.sin(t * Math.PI * 2 + spec.seed),
      Math.cos(a) * spec.rz * swell,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, spec.r, RADIAL_SEGMENTS, false);
  const pos = geo.attributes.position;
  const P = new THREE.Vector3();
  const V = new THREE.Vector3();
  for (let j = 0; j <= TUBE_SEGMENTS; j++) {
    const u = j / TUBE_SEGMENTS;
    curve.getPointAt(u, P);
    const k = Math.pow(Math.sin(Math.PI * u), 0.75) * (0.72 + 0.28 * Math.sin(u * Math.PI * 7 + spec.seed));
    for (let i = 0; i <= RADIAL_SEGMENTS; i++) {
      const idx = j * (RADIAL_SEGMENTS + 1) + i;
      V.fromBufferAttribute(pos, idx).sub(P).multiplyScalar(k).add(P);
      pos.setXYZ(idx, V.x, V.y, V.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export class Splash {
  constructor(rand) {
    this.group = new THREE.Group();
    this.material = new THREE.MeshPhysicalMaterial({
      color: '#d99a3a', metalness: 0.62, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
      emissive: '#6a3806', emissiveIntensity: 0.55, envMapIntensity: 1.4,
    });

    this.ribbons = RIBBONS.map((spec) => {
      const mesh = new THREE.Mesh(ribbonGeometry(spec), this.material);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });

    const N = 48;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), this.material, N);
    this.drops.frustumCulled = false;
    this.dropData = Array.from({ length: N }, () => {
      const a = rand() * Math.PI * 2;
      const r = 1.25 + rand() * 1.3;
      return {
        pos: new THREE.Vector3(Math.sin(a) * r, -1.3 + rand() * 3.1, Math.cos(a) * r * 0.75),
        size: 0.012 + Math.pow(rand(), 2.8) * 0.048,
        phase: rand() * Math.PI * 2,
        delay: rand() * 0.35,
      };
    });
    this.group.add(this.drops);
    this.dummy = new THREE.Object3D();
    this.amount = 1;
    this.tmp = new THREE.Color();
  }

  setColor(color, glow) {
    this.material.color.copy(color);
    this.material.emissive.copy(glow);
  }

  // amount: 0 = retracted, 1 = fully poured
  update(time, amount) {
    this.amount = amount;
    this.group.visible = amount > 0.001;
    if (!this.group.visible) return;

    const grow = ease.inOutCubic(clamp(amount));
    this.ribbons.forEach((mesh, i) => {
      const local = clamp(grow * 1.25 - i * 0.08);
      const segs = Math.floor(local * TUBE_SEGMENTS);
      mesh.geometry.setDrawRange(0, segs * RADIAL_SEGMENTS * 6);
      mesh.rotation.y = Math.sin(time * 0.15 + i) * 0.04;
    });

    const d = this.dummy;
    this.dropData.forEach((drop, i) => {
      const k = ease.outExpo(clamp((amount - drop.delay) / (1 - drop.delay)));
      d.position.copy(drop.pos).multiplyScalar(0.25 + 0.75 * k);
      d.position.y += Math.sin(time * 0.9 + drop.phase) * 0.06;
      d.position.x += Math.cos(time * 0.6 + drop.phase) * 0.03;
      const s = drop.size * k * (1 + Math.sin(time * 2 + drop.phase) * 0.06);
      d.scale.set(s, s * 1.08, s);
      d.updateMatrix();
      this.drops.setMatrixAt(i, d.matrix);
    });
    this.drops.instanceMatrix.needsUpdate = true;
  }
}
