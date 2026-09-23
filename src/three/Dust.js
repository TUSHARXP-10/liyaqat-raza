import * as THREE from 'three';

// Drifting gold motes and soft foreground bokeh, all on the GPU.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScroll;
  uniform float uSizeScale;
  attribute float aSeed;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float speed = 0.04 + aSeed * 0.1;
    p.y = mod(p.y + uTime * speed + uScroll * (0.4 + aSeed * 0.8) + 7.0, 14.0) - 7.0;
    p.x += sin(uTime * 0.22 + aSeed * 21.0) * 0.4;
    p.z += cos(uTime * 0.18 + aSeed * 13.0) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uSizeScale * uPixelRatio * (12.0 / -mv.z);
    float twinkle = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 40.0);
    vAlpha = twinkle * smoothstep(0.5, 3.0, -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoft;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, uSoft, d);
    a *= a;
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
  }
`;

function field(count, { spread, sizeMin, sizeMax, opacity, soft, color, rand }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * spread[0];
    pos[i * 3 + 1] = (rand() - 0.5) * spread[1];
    pos[i * 3 + 2] = spread[2][0] + rand() * (spread[2][1] - spread[2][0]);
    seed[i] = rand();
    size[i] = sizeMin + Math.pow(rand(), 3) * (sizeMax - sizeMin);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uScroll: { value: 0 },
      uSizeScale: { value: 1 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSoft: { value: soft },
    },
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export class Dust {
  constructor(rand, mobile = false) {
    this.group = new THREE.Group();
    this.motes = field(mobile ? 700 : 1500, {
      spread: [22, 14, [-9, 6]], sizeMin: 2, sizeMax: 11, opacity: 0.85, soft: 0.0, color: '#f0c56a', rand,
    });
    this.bokeh = field(mobile ? 24 : 46, {
      spread: [16, 12, [1, 6.5]], sizeMin: 40, sizeMax: 150, opacity: 0.09, soft: 0.25, color: '#e8a64a', rand,
    });
    this.group.add(this.motes, this.bokeh);
    this.baseOpacity = [0.85, 0.09];
  }

  setPixelRatio(pr) {
    this.motes.material.uniforms.uPixelRatio.value = pr;
    this.bokeh.material.uniforms.uPixelRatio.value = pr;
  }

  update(time, scroll, intensity) {
    [this.motes, this.bokeh].forEach((p, i) => {
      const u = p.material.uniforms;
      u.uTime.value = time;
      u.uScroll.value = scroll;
      u.uOpacity.value = this.baseOpacity[i] * intensity;
    });
  }
}
