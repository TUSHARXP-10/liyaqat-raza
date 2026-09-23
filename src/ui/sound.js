// Generative ambience, no audio files: a warm D drone breathing through a
// slow filter, plus sparse chimes on the Hijaz scale, all in a synthetic hall.

const HIJAZ = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33, 622.25, 739.99];

function impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = rate * seconds;
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export class Ambient {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.timer = null;
  }

  #build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    const master = (this.master = ctx.createGain());
    master.gain.value = 0;
    master.connect(comp);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 5, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    reverb.connect(wet).connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.45;
    dry.connect(master);
    this.bus = { reverb, dry };

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.9;
    filter.connect(dry);
    filter.connect(reverb);

    [[73.42, 'sawtooth', 0.05, -6], [110, 'sawtooth', 0.032, 5], [146.83, 'triangle', 0.035, -3], [220, 'sine', 0.018, 4]].forEach(
      ([f, type, g, detune]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.value = g;
        o.connect(gain).connect(filter);
        o.start();
      },
    );
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  #chime() {
    if (!this.on) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const f = HIJAZ[Math.floor(Math.random() * HIJAZ.length)];
    [1, 2.01, 3.02].forEach((h, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * h;
      const g = ctx.createGain();
      const peak = [0.05, 0.012, 0.006][i];
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.8 - i);
      o.connect(g);
      g.connect(this.bus.reverb);
      g.connect(this.bus.dry);
      o.start(now);
      o.stop(now + 4);
    });
    this.timer = setTimeout(() => this.#chime(), 2600 + Math.random() * 4800);
  }

  start() {
    try {
      if (!this.ctx) this.#build();
    } catch {
      return false;
    }
    this.on = true;
    this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.9, t, 1.2);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.#chime(), 1400);
    return true;
  }

  stop() {
    this.on = false;
    clearTimeout(this.timer);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.4);
  }

  // soft accent for key story beats
  swell() {
    if (!this.on) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    [HIJAZ[0] / 2, HIJAZ[4] / 2, HIJAZ[7] / 2].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.03, now + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 5);
      o.connect(g).connect(this.bus.reverb);
      o.start(now);
      o.stop(now + 5.2);
    });
  }
}
