// Mechanical odometer: each digit column rolls continuously and only carries
// when the column below passes 9, like a real counter being wound back.

export class Odometer {
  constructor(el, digits = 4) {
    this.el = el;
    this.strips = [];
    for (let i = 0; i < digits; i++) {
      const col = document.createElement('span');
      col.className = 'odo__col';
      const strip = document.createElement('span');
      strip.className = 'odo__strip';
      for (let d = 0; d <= 10; d++) {
        const s = document.createElement('span');
        s.textContent = d % 10;
        strip.appendChild(s);
      }
      col.appendChild(strip);
      el.appendChild(col);
      this.strips.unshift(strip); // strips[0] = ones
    }
  }

  set(value) {
    const y = Math.max(0, value);
    this.strips.forEach((strip, k) => {
      const p = 10 ** k;
      let pos;
      if (k === 0) {
        pos = y % 10;
      } else {
        const digit = Math.floor(y / p) % 10;
        const lower = y % p;
        pos = digit + Math.max(0, lower - (p - 1));
      }
      strip.style.transform = `translateY(${-pos * 1.2}em)`;
    });
  }
}
