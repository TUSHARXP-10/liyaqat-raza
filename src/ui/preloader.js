import { gsap } from 'gsap';

// The curtain: Arabic mark written right-to-left, real loading progress,
// then a choice to enter with or without sound, then the split reveal.

export class Preloader {
  constructor() {
    this.el = document.querySelector('[data-preloader]');
    this.bar = this.el.querySelector('[data-pre-bar]');
    this.count = this.el.querySelector('[data-pre-count]');
    this.enter = this.el.querySelector('[data-pre-enter]');
    this.shown = { v: 0 };
    this.parts = {};
    this.target = 0;

    this.intro = gsap.timeline()
      .to('[data-pre-arabic]', { clipPath: 'inset(-10% -10% -10% -10%)', duration: 2.4, ease: 'power2.inOut' }, 0.2)
      .from('[data-pre-word]', { opacity: 0, letterSpacing: '1.1em', duration: 2, ease: 'expo.out' }, 0.9)
      .from('.preloader__sub, .preloader__progress, .preloader__hint', { opacity: 0, y: 12, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 1.2);

    this.ticker = () => {
      this.shown.v += (this.target - this.shown.v) * 0.08;
      const p = Math.min(1, this.shown.v);
      this.bar.style.transform = `scaleX(${p})`;
      this.count.textContent = String(Math.round(p * 100)).padStart(3, '0');
    };
    gsap.ticker.add(this.ticker);
  }

  // weighted progress from several loaders
  set(key, value, weight = 1) {
    this.parts[key] = { value, weight };
    const all = Object.values(this.parts);
    const total = all.reduce((a, p) => a + p.weight, 0);
    this.target = all.reduce((a, p) => a + p.value * p.weight, 0) / total;
  }

  async complete() {
    this.target = 1;
    await new Promise((resolve) => {
      const check = () => (this.shown.v > 0.995 && this.intro.progress() > 0.85 ? resolve() : requestAnimationFrame(check));
      check();
    });
    this.shown.v = 1;
    this.ticker();
    gsap.ticker.remove(this.ticker);
  }

  waitForEnter() {
    gsap.to('.preloader__progress', { opacity: 0, y: -10, duration: 0.6 });
    gsap.to(this.enter, { autoAlpha: 1, y: 0, duration: 1, delay: 0.3, ease: 'expo.out' });
    return new Promise((resolve) => {
      this.enter.querySelectorAll('[data-enter]').forEach((b) =>
        b.addEventListener('click', () => resolve(b.dataset.enter), { once: true }),
      );
    });
  }

  reveal() {
    const tl = gsap.timeline({ onComplete: () => this.el.remove() });
    tl.to('.preloader__inner', { opacity: 0, scale: 0.96, filter: 'blur(8px)', duration: 0.8, ease: 'power2.in' })
      .to('.preloader__seam', { scaleX: 1, duration: 0.9, ease: 'expo.inOut' }, 0.3)
      .to('.preloader__half--top', { yPercent: -100, duration: 1.6, ease: 'expo.inOut' }, 1.05)
      .to('.preloader__half--bottom', { yPercent: 100, duration: 1.6, ease: 'expo.inOut' }, 1.05)
      .to('.preloader__seam', { opacity: 0, scaleY: 30, duration: 1.1, ease: 'expo.out' }, 1.1);
    return tl;
  }
}
