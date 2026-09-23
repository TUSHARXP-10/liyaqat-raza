import { gsap } from 'gsap';
import { isTouch } from '../lib/math.js';

// Gold ring cursor with a trailing lag, hover states, labels, and magnetic
// buttons that lean toward the pointer.

export function initCursor() {
  const root = document.querySelector('[data-cursor]');
  if (!root || isTouch()) return;
  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const text = root.querySelector('[data-cursor-text]');

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };
  const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') };
  const setRing = { x: gsap.quickSetter(ring, 'x', 'px'), y: gsap.quickSetter(ring, 'y', 'px') };

  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    setDot.x(pos.x);
    setDot.y(pos.y);
    root.classList.remove('is-hidden');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.add('is-hidden'));

  gsap.ticker.add((_, dt) => {
    const k = 1 - Math.pow(0.001, dt / 1000 * 0.9);
    ringPos.x += (pos.x - ringPos.x) * k;
    ringPos.y += (pos.y - ringPos.y) * k;
    setRing.x(ringPos.x);
    setRing.y(ringPos.y);
  });

  const interactive = 'a, button, input, [data-magnetic]';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(interactive);
    if (!t) return;
    root.classList.add('is-hover');
    const label = t.getAttribute('data-cursor-label');
    if (label) {
      text.textContent = label;
      root.classList.add('has-label');
    }
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest(interactive);
    if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    root.classList.remove('is-hover', 'has-label');
  });

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}
