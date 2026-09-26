import { api, configured } from './api.js';
import { $, $$, esc, icon, toast } from './ui.js';
import { dashboard, content, films, media, settings } from './views/site.js';
import { products, productEditor, prices } from './views/catalog.js';
import { orders, subscribers } from './views/orders.js';

// Raza Perfume admin panel (/admin): sign-in, layout, routing and a shared
// data cache. Each page lives in views/*.js.

const app = $('#app');

/* ------------------------------------------------------------ data cache */
export const store = {
  data: {},
  async get(name, force = false) {
    if (!force && this.data[name]) return this.data[name];
    const list = await api[name].list();
    this.data[name] = list;
    return list;
  },
  set(name, list) {
    this.data[name] = list;
    refreshCounts();
  },
};

/* --------------------------------------------------------------- routing */
const ROUTES = [
  { path: /^\/?$/, view: dashboard, nav: 'dash' },
  { path: /^\/products\/?$/, view: products, nav: 'products' },
  { path: /^\/products\/(.+)$/, view: productEditor, nav: 'products' },
  { path: /^\/prices\/?$/, view: prices, nav: 'prices' },
  { path: /^\/orders\/?$/, view: orders, nav: 'orders' },
  { path: /^\/content(?:\/(.+))?$/, view: content, nav: 'content' },
  { path: /^\/films\/?$/, view: films, nav: 'films' },
  { path: /^\/media(?:\/(.*))?$/, view: media, nav: 'media' },
  { path: /^\/subscribers\/?$/, view: subscribers, nav: 'subscribers' },
  { path: /^\/settings\/?$/, view: settings, nav: 'settings' },
];
const NAV = [
  ['dash', '#/', 'Dashboard', 'dash'],
  ['products', '#/products', 'Products', 'box'],
  ['prices', '#/prices', 'Price list', 'tag'],
  ['orders', '#/orders', 'Orders', 'bag'],
  ['label', 'Website'],
  ['content', '#/content', 'Site content', 'text'],
  ['films', '#/films', 'Films', 'film'],
  ['media', '#/media', 'Media library', 'image'],
  ['label', 'People'],
  ['subscribers', '#/subscribers', 'Subscribers', 'mail'],
  ['settings', '#/settings', 'Settings', 'gear'],
];

// unsaved work: views set guard.dirty; leaving asks first
export const guard = { dirty: false, message: 'You have unsaved changes. Leave without saving?' };
let current = location.hash;
window.addEventListener('beforeunload', (e) => {
  if (guard.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function route() {
  if (guard.dirty && location.hash !== current) {
    if (!window.confirm(guard.message)) {
      history.replaceState(null, '', current);
      return;
    }
    guard.dirty = false;
  }
  current = location.hash;
  app.classList.remove('menu-open');
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const hit = ROUTES.map((r) => ({ r, m: path.match(r.path) })).find((x) => x.m) || { r: ROUTES[0], m: [] };
  $$('.side__nav a').forEach((a) => a.classList.toggle('is-on', a.dataset.nav === hit.r.nav));
  // a fresh container per page, so one page's listeners never act on another
  const old = $('[data-page]');
  const page = old.cloneNode(false);
  old.replaceWith(page);
  guard.dirty = false;
  const top = $('[data-top]');
  page.innerHTML = '<div class="stack"><div class="skeleton" style="width:40%"></div><div class="skeleton"></div><div class="skeleton" style="width:70%"></div></div>';
  top.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    await hit.r.view({ page, top, params: hit.m.slice(1), store, guard, go: (h) => (location.hash = h), setTitle });
  } catch (err) {
    console.error(err);
    page.innerHTML = `<div class="empty"><b>Something went wrong</b>${esc(err.message)}<br /><br /><button class="btn" type="button" onclick="location.reload()">Reload</button></div>`;
  }
}

function setTitle(title, sub = '', actions = '') {
  $('[data-top]').innerHTML = `
    <button class="icon-btn top__menu" type="button" data-menu aria-label="Menu">${icon('menu')}</button>
    <div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    <div class="top__actions">${actions}</div>`;
  document.title = `${title} · Raza admin`;
}

async function refreshCounts() {
  const list = store.data.orders;
  const el = $('[data-count="orders"]');
  if (!el || !list) return;
  const n = list.filter((o) => o.status === 'new').length;
  el.textContent = n;
  el.hidden = !n;
}

/* ---------------------------------------------------------------- layout */
function shell(email) {
  app.innerHTML = `
    <div class="layout">
      <nav class="side" aria-label="Admin">
        <a class="side__brand" href="#/"><img src="/brand/raza-mark-light.svg" alt="" /><span><b>Raza Perfume</b><small>Admin</small></span></a>
        <div class="side__nav">
          ${NAV.map(([key, href, label, ic]) => (key === 'label'
            ? `<p class="side__label">${esc(href)}</p>`
            : `<a href="${href}" data-nav="${key}">${icon(ic)}<span>${esc(label)}</span>${key === 'orders' ? '<span class="count" data-count="orders" hidden></span>' : ''}</a>`)).join('')}
        </div>
        <div class="side__foot">
          <p title="${esc(email)}">${esc(email)}</p>
          <div class="row">
            <a class="btn btn--sm" href="/" target="_blank" rel="noopener">${icon('eye')}View site</a>
            <button class="btn btn--sm btn--ghost" type="button" data-signout>${icon('out')}Sign out</button>
          </div>
        </div>
      </nav>
      <div class="main">
        ${api.mode === 'demo' ? `<div class="demo" role="note"><b>Demo mode.</b> ${configured() ? 'Opened with ?demo.' : 'Supabase isn’t connected yet.'} Changes stay in this browser and don’t change the live site.<button type="button" data-demo-reset>Reset demo</button><a href="#/settings" style="color:#dcecf8;text-decoration:underline">How to go live</a></div>` : ''}
        <header class="top" data-top></header>
        <main class="page" data-page></main>
      </div>
    </div>`;
  $('[data-signout]').addEventListener('click', async () => {
    await api.auth.signOut();
    location.hash = '#/';
    boot();
  });
  $('[data-demo-reset]')?.addEventListener('click', () => {
    api.reset();
    store.data = {};
    toast('Demo reset to the site’s catalogue.', 'info');
    route();
  });
  window.addEventListener('hashchange', route); // the same listener is only ever added once
  route();
  store.get('orders').then(refreshCounts).catch(() => {});
}

/* ----------------------------------------------------------------- login */
function login({ error = '', mode = 'signin' } = {}) {
  window.removeEventListener('hashchange', route);
  const demo = api.mode === 'demo';
  app.innerHTML = `
    <div class="login">
      <div class="login__card">
        <img src="/brand/raza-logo-light.svg" alt="Raza Perfume NX2" />
        <h1>${mode === 'reset' ? 'Choose a new password' : mode === 'forgot' ? 'Reset your password' : 'Admin sign in'}</h1>
        <form data-form novalidate>
          ${mode === 'reset' ? `
            <label class="field"><span>New password</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required /></label>` : `
            <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="username" required ${demo ? 'value="demo@razaperfume.com"' : ''} /></label>
            ${mode === 'signin' ? `<label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" required ${demo ? 'value="demo1234"' : ''} /></label>` : ''}`}
          <p class="login__err" role="alert" data-err>${esc(error)}</p>
          <button class="btn btn--gold" type="submit">${mode === 'reset' ? 'Save password' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
        </form>
        <p class="login__alt">${mode === 'signin' ? '<button type="button" data-mode="forgot">Forgot password?</button>' : '<button type="button" data-mode="signin">Back to sign in</button>'}</p>
        ${demo ? '<p class="login__alt dim">Demo mode: any email and password work.</p>' : ''}
      </div>
    </div>`;
  const form = $('[data-form]');
  const err = $('[data-err]');
  $('[data-mode]')?.addEventListener('click', (e) => login({ mode: e.target.dataset.mode }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (mode === 'reset') {
        if (form.password.value.length < 8) throw new Error('Use at least 8 characters.');
        await api.auth.setPassword(form.password.value);
        toast('Password saved.');
        history.replaceState(null, '', '/admin#/');
        boot();
      } else if (mode === 'forgot') {
        await api.auth.resetPassword(form.email.value);
        err.style.color = 'var(--ok)';
        err.textContent = 'If that email has an account, a reset link is on its way.';
      } else {
        await api.auth.signIn(form.email.value, form.password.value);
        boot();
      }
    } catch (ex) {
      err.style.color = '';
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });
  form.querySelector('input')?.focus();
}

function notAdmin(email) {
  app.innerHTML = `
    <div class="login"><div class="login__card" style="text-align:center">
      <img src="/brand/raza-logo-light.svg" alt="Raza Perfume NX2" />
      <h1>No admin access</h1>
      <p class="muted" style="margin-bottom:20px">${esc(email)} is signed in, but isn’t on the admin list. Ask an admin to add this email under Settings → Admins.</p>
      <button class="btn" type="button" data-out>Sign in with another account</button>
    </div></div>`;
  $('[data-out]').addEventListener('click', async () => {
    await api.auth.signOut();
    login();
  });
}

// phones: the menu button opens the sidebar; a tap outside closes it
app.addEventListener('click', (e) => {
  if (e.target.closest('[data-menu]')) app.classList.toggle('menu-open');
  else if (app.classList.contains('menu-open') && !e.target.closest('.side')) app.classList.remove('menu-open');
});

/* ------------------------------------------------------------------ boot */
let recovering = false;
async function boot() {
  try {
    const session = await api.auth.session();
    if (recovering) return login({ mode: 'reset' });
    if (!session) return login();
    if (!(await api.auth.isAdmin())) return notAdmin(session.user.email);
    shell(session.user.email);
  } catch (err) {
    login({ error: err.message });
  }
}
api.auth.onChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recovering = true;
    login({ mode: 'reset' });
  }
});
boot();
