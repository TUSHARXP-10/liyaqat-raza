// Privacy choices: a small notice that asks before anything measures visits.
//
// The site uses no advertising or tracking cookies. With the visitor's OK it
// loads Vercel Web Analytics (anonymous page views) and Speed Insights (real
// load times), both cookieless. Nothing loads before "Allow", "No thanks" is
// remembered, and the Privacy Policy page can reset the choice.
// Analytics only runs on the live site (not localhost), and only if it is
// switched on in the Vercel project (Analytics / Speed Insights tabs).

const KEY = 'raza-consent-v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = (analytics) => { try { localStorage.setItem(KEY, JSON.stringify({ analytics, at: new Date().toISOString() })); } catch { /* storage unavailable */ } };
const isLive = () => !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);

let loaded = false;
function loadAnalytics() {
  if (loaded || !isLive()) return;
  loaded = true;
  window.va = window.va || function va(...args) { (window.vaq = window.vaq || []).push(args); };
  window.si = window.si || function si(...args) { (window.siq = window.siq || []).push(args); };
  for (const src of ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js']) {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.append(s);
  }
}

function ask() {
  const box = document.createElement('div');
  box.className = 'consent';
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Privacy choices');
  box.innerHTML = `
    <p class="consent__text">We keep your bag and wishlist on this device. With your OK, we also count visits anonymously, with no cookies, to make the site better. <a href="/privacy">Privacy policy</a></p>
    <div class="consent__actions">
      <button type="button" class="consent__no" data-consent="no">No thanks</button>
      <button type="button" class="btn btn--solid consent__yes" data-consent="yes"><span class="btn__label">Allow</span></button>
    </div>`;
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const yes = b.dataset.consent === 'yes';
    write(yes);
    if (yes) loadAnalytics();
    box.classList.remove('is-on');
    setTimeout(() => box.remove(), 500);
  });
  document.body.append(box);
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-on')));
}

// Call once the page is ready to be seen (on the story site: after the intro).
export function initConsent() {
  const choice = read();
  if (choice?.analytics === true) loadAnalytics();
  else if (!choice) ask();
}
