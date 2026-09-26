import { DEFAULTS, FIELDS } from './fields.js';
import { SHOP } from '../content.js';
import { fetchContent } from '../shop/backend.js';

// Site copy edited in the admin panel. The page ships with the default
// wording; saved values (Supabase site_content) are loaded while the intro
// still covers the page and applied before any text is animated.

const values = { ...DEFAULTS };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const digits = (s) => String(s ?? '').replace(/\D/g, '');

export const cms = {
  get: (key) => values[key] ?? DEFAULTS[key],
};

// never waits longer than `timeout`: a slow network shows the built-in copy
export async function loadContent({ timeout = 2500 } = {}) {
  try {
    const rows = await Promise.race([fetchContent(), new Promise((r) => setTimeout(() => r(null), timeout))]);
    for (const row of rows || []) if (row.key in DEFAULTS && row.value !== null) values[row.key] = row.value;
  } catch (err) {
    console.warn('[raza] could not load site content, using built-in copy', err);
  }
  applySettings();
  return values;
}

// contact details drive the order WhatsApp number and the call links
function applySettings() {
  const wa = digits(values['contact.whatsapp']);
  if (wa.length >= 10) {
    SHOP.whatsapp = wa.length === 10 ? `91${wa}` : wa;
    SHOP.whatsappLabel = values['contact.whatsapp'];
  }
  const phone = digits(values['contact.phone']);
  if (phone.length >= 10) {
    SHOP.phone = `+${phone.length === 10 ? `91${phone}` : phone}`;
    SHOP.phoneLabel = values['contact.phone'];
  }
  if (/^https?:\/\//.test(values['contact.instagram'] || '')) SHOP.instagram = values['contact.instagram'];
}

function fill(el, field, value) {
  const b = field.bind;
  if (field.type === 'lines') {
    const lines = Array.isArray(value) ? value : String(value).split('\n');
    if (b.br) {
      el.innerHTML = lines.map(esc).join('<br />');
      return;
    }
    const slots = [...el.querySelectorAll(b.lines)];
    lines.forEach((line, i) => {
      let slot = slots[i];
      if (!slot && slots.length) {
        slot = slots[slots.length - 1].cloneNode(false);
        slots[slots.length - 1].after(slot);
      }
      if (slot) slot.textContent = line;
    });
    slots.slice(lines.length).forEach((s) => s.remove());
    return;
  }
  if (b.count) {
    const n = el.querySelector('[data-shop-total]')?.textContent || '';
    el.innerHTML = esc(value).replace('{count}', `<span data-shop-total>${esc(n)}</span>`);
    return;
  }
  el.textContent = value;
}

export function applyContent(root = document) {
  for (const f of FIELDS) {
    if (!f.bind) continue;
    const value = values[f.key];
    if (JSON.stringify(value) === JSON.stringify(DEFAULTS[f.key])) continue; // the page already says it
    root.querySelectorAll(f.bind.sel).forEach((el) => fill(el, f, value));
  }

  // numbers and links everywhere
  const oldWa = digits(DEFAULTS['contact.whatsapp']);
  root.querySelectorAll('a[href*="wa.me/"]').forEach((a) => {
    a.href = a.href.replace(/wa\.me\/\d*/, `wa.me/${SHOP.whatsapp}`);
    if (digits(a.textContent) === oldWa) a.textContent = SHOP.whatsappLabel;
  });
  const oldPhone = digits(DEFAULTS['contact.phone']);
  root.querySelectorAll('a[href^="tel:"]').forEach((a) => {
    a.href = `tel:${SHOP.phone}`;
    if (digits(a.textContent) === oldPhone) a.textContent = SHOP.phoneLabel;
  });
  root.querySelectorAll('a[href*="instagram.com"]').forEach((a) => (a.href = SHOP.instagram));

  // search & sharing (for the story page only; other pages set their own titles)
  if (root === document && document.documentElement.dataset.page !== 'blogs') {
    if (values['seo.title'] !== DEFAULTS['seo.title']) document.title = values['seo.title'];
    if (values['seo.description'] !== DEFAULTS['seo.description']) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', values['seo.description']);
    }
  }

  announce();
}

// the slim bar across the top (dismissed for the rest of the visit)
function announce() {
  document.querySelector('.announce')?.remove();
  document.documentElement.classList.remove('has-announce');
  if (!values['announce.enabled'] || !values['announce.text']) return;
  const key = `raza-announce-${values['announce.text']}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch { /* storage unavailable */ }
  const bar = document.createElement('div');
  bar.className = 'announce';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Announcement');
  const link = values['announce.link'] && values['announce.linkLabel']
    ? ` <a class="announce__link" href="${esc(values['announce.link'])}">${esc(values['announce.linkLabel'])} →</a>` : '';
  bar.innerHTML = `<p><span class="announce__text">${esc(values['announce.text'])}</span>${link}</p><button type="button" class="announce__close" aria-label="Dismiss">×</button>`;
  bar.querySelector('.announce__close').addEventListener('click', () => {
    bar.remove();
    document.documentElement.classList.remove('has-announce');
    try {
      sessionStorage.setItem(key, '1');
    } catch { /* storage unavailable */ }
  });
  document.body.prepend(bar);
  document.documentElement.classList.add('has-announce');
}
