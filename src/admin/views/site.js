import { api, slug } from '../api.js';
import { $, $$, esc, icon, toast, drawer, confirmBox, rupees, ago, bytes, uid, toWebp, videoInfo } from '../ui.js';
import { SECTIONS, FIELD } from '../../cms/fields.js';
import { SHOP } from '../../content.js';
import { statusBadge, orderTotal } from './orders.js';
import { allFilms, CATEGORIES, CAT } from '../films-data.js';

// Dashboard, site content, films, media library and settings.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ============================================================== dashboard */

export async function dashboard({ page, store, setTitle }) {
  setTitle('Dashboard', new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    '<a class="btn" href="/" target="_blank" rel="noopener">View site</a><a class="btn btn--gold" href="#/products/new">Add fragrance</a>');
  const [products, orders, subs, content] = await Promise.all([
    store.get('products'), store.get('orders').catch(() => []), store.get('subscribers').catch(() => []), store.get('content').catch(() => []),
  ]);
  const visible = products.filter((p) => p.active);
  const sizes = products.flatMap((p) => p.variants || []);
  const priced = sizes.filter((v) => v.price != null).length;
  const unpricedList = products.filter((p) => p.category !== 'house' && (p.variants?.length ? p.variants.some((v) => v.price == null) : p.price == null));
  const noPhoto = products.filter((p) => p.category !== 'house' && !p.images?.length);
  const fresh = orders.filter((o) => o.status === 'new');
  const week = orders.filter((o) => o.status !== 'cancelled' && Date.now() - new Date(o.created_at) < 7 * 86400e3);
  const weekValue = week.reduce((s, o) => s + (Number(o.subtotal) || 0), 0);
  const subsWeek = subs.filter((s) => Date.now() - new Date(s.created_at) < 7 * 86400e3).length;
  const announceOn = content.find((c) => c.key === 'announce.enabled')?.value === true;
  const pct = sizes.length ? Math.round((priced / sizes.length) * 100) : 0;

  const todos = [
    fresh.length && ['bag', `<b>${fresh.length} new order${fresh.length === 1 ? '' : 's'}</b> waiting to be confirmed on WhatsApp.`, '#/orders', 'Open orders'],
    unpricedList.length && ['tag', `<b>${unpricedList.length} fragrance${unpricedList.length === 1 ? '' : 's'}</b> still show “price on request” for some sizes.`, '#/prices', 'Set prices'],
    noPhoto.length && ['image', `<b>${noPhoto.length} fragrance${noPhoto.length === 1 ? '' : 's'}</b> have no photo yet (the site shows the studio render).`, '#/products', 'Add photos'],
    !announceOn && ['text', 'No announcement bar is showing. Use it for an offer or news.', '#/content/announce', 'Write one'],
  ].filter(Boolean);

  page.innerHTML = `
    <div class="kpis">
      <a class="card kpi linkish" href="#/products"><p class="kpi__label">Fragrances on the site</p><p class="kpi__value">${visible.length}</p><p class="kpi__note">${products.length - visible.length} hidden · ${products.filter((p) => p.featured).length} featured</p></a>
      <a class="card kpi linkish" href="#/prices"><p class="kpi__label">Sizes priced</p><p class="kpi__value">${pct}%</p><p class="kpi__note">${priced} of ${sizes.length} sizes</p><div class="bar"><i style="width:${pct}%"></i></div></a>
      <a class="card kpi linkish" href="#/orders"><p class="kpi__label">Orders this week</p><p class="kpi__value">${week.length}</p><p class="kpi__note">${rupees(weekValue)}${week.some((o) => o.has_unpriced) ? ' + on request' : ''} · ${fresh.length} new</p></a>
      <a class="card kpi linkish" href="#/subscribers"><p class="kpi__label">Subscribers</p><p class="kpi__value">${subs.length}</p><p class="kpi__note">${subsWeek} this week</p></a>
    </div>
    <div class="grid2" style="align-items:start">
      <section class="card"><header class="card__head"><h2>To do</h2></header>
        ${todos.length ? todos.map(([ic, text, href, cta]) => `<div class="todo"><span class="todo__icon">${icon(ic)}</span><p>${text}</p><a class="btn btn--sm" href="${href}">${cta}</a></div>`).join('') : '<div class="empty"><b>All done</b>Nothing needs attention.</div>'}
      </section>
      <section class="card"><header class="card__head"><h2>Latest orders</h2><div class="top__actions"><a class="btn btn--sm" href="#/orders">All orders</a></div></header>
        ${orders.length ? `<div class="table-wrap"><table class="table">${orders.slice(0, 6).map((o) => `<tr><td><b class="num">#${o.order_number}</b><br /><small class="dim">${ago(o.created_at)}</small></td><td>${esc(o.customer_name)}<br /><small class="dim">${esc(o.customer_city || o.customer_phone)}</small></td><td class="num">${orderTotal(o)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</table></div>` : '<div class="empty"><b>No orders yet</b>They appear here as soon as a customer places one.</div>'}
      </section>
    </div>
    <section class="card" style="margin-top:20px"><header class="card__head"><h2>Quick links</h2></header><div class="card__body row">
      <a class="btn" href="#/content/hero">${icon('text')}Edit the opening slides</a>
      <a class="btn" href="#/content/announce">${icon('text')}Announcement bar</a>
      <a class="btn" href="#/films">${icon('film')}Upload a film</a>
      <a class="btn" href="#/prices">${icon('tag')}Price list</a>
      <a class="btn" href="/blogs" target="_blank" rel="noopener">${icon('eye')}Blogs Raza page</a>
    </div></section>`;
}

/* ================================================================ content */

export async function content({ page, params, store, guard, setTitle }) {
  const rows = await store.get('content');
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const section = SECTIONS.find((s) => s.key === params[0]) || SECTIONS[0];
  setTitle('Site content', 'Words on the website. Changes show on the site as soon as you save.', `<a class="btn" href="/" target="_blank" rel="noopener">${icon('eye')}Open the site</a>`);
  const edited = (s) => s.fields.some((f) => f.key in saved && !same(saved[f.key], f.default));
  const valueOf = (f) => (f.key in saved ? saved[f.key] : f.default);

  const input = (f) => {
    const v = valueOf(f);
    const mark = f.key in saved && !same(saved[f.key], f.default) ? ' is-edited' : '';
    if (f.type === 'toggle') return `<label class="switch"><input type="checkbox" data-key="${f.key}"${v ? ' checked' : ''} /><i></i>${esc(f.label)}</label>`;
    if (f.type === 'textarea') return `<textarea class="textarea${mark}" data-key="${f.key}" ${f.max ? `maxlength="${f.max}"` : ''}>${esc(v)}</textarea>`;
    if (f.type === 'lines') {
      const lines = Array.isArray(v) ? v : String(v).split('\n');
      return `<div class="lines">${Array.from({ length: f.count || lines.length }, (_, i) => `<input class="input${mark}" data-key="${f.key}" data-line="${i}" value="${esc(lines[i] ?? '')}" aria-label="${esc(f.label)}, line ${i + 1}" />`).join('')}</div>`;
    }
    return `<input class="input${mark}" data-key="${f.key}" ${f.type === 'phone' ? 'type="tel"' : ''} ${f.max ? `maxlength="${f.max}"` : ''} value="${esc(v)}" />`;
  };

  page.innerHTML = `
    <div class="content-layout">
      <nav class="content-nav" aria-label="Sections">${SECTIONS.map((s) => `<a href="#/content/${s.key}" class="${s === section ? 'is-on' : ''}"><span>${esc(s.title)}</span>${edited(s) ? '<span class="badge badge--gold badge--plain">Edited</span>' : ''}</a>`).join('')}</nav>
      <section class="card"><header class="card__head"><div><h2>${esc(section.title)}</h2>${section.note ? `<p>${esc(section.note)}</p>` : ''}</div></header>
        <div class="card__body stack">
          ${section.fields.map((f) => `
            <div class="field" data-field="${f.key}">
              ${f.type === 'toggle' ? '' : `<div class="field__head"><span class="label">${esc(f.label)}</span>${f.key in saved && !same(saved[f.key], f.default) ? `<button class="btn btn--sm btn--ghost" type="button" data-reset="${f.key}">Reset to original</button>` : ''}</div>`}
              ${input(f)}
              ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}
            </div>`).join('')}
        </div>
      </section>
    </div>
    <div class="savebar" data-savebar><p>Unsaved changes</p><span class="spacer"></span><button class="btn" type="button" data-discard>Discard</button><button class="btn btn--gold" type="button" data-save>Save &amp; publish</button></div>`;

  const read = (f) => {
    if (f.type === 'toggle') return $(`[data-key="${f.key}"]`, page).checked;
    if (f.type === 'lines') return $$(`[data-key="${f.key}"]`, page).map((i) => i.value.trim());
    return $(`[data-key="${f.key}"]`, page).value.trim();
  };
  const setDirty = (on) => {
    guard.dirty = on;
    $('[data-savebar]', page).classList.toggle('is-on', on);
  };
  page.addEventListener('input', () => setDirty(true));
  page.addEventListener('change', () => setDirty(true));
  page.addEventListener('click', async (e) => {
    const reset = e.target.closest('[data-reset]');
    if (reset) {
      const f = FIELD[reset.dataset.reset];
      try {
        await api.content.reset([f.key]);
        store.set('content', store.data.content.filter((r) => r.key !== f.key));
        toast(`“${f.label}” is back to the original wording.`);
        guard.dirty = false;
        content({ page, params, store, guard, setTitle });
      } catch (err) {
        toast(err.message, 'bad');
      }
    } else if (e.target.closest('[data-discard]')) {
      guard.dirty = false;
      content({ page, params, store, guard, setTitle });
    } else if (e.target.closest('[data-save]')) {
      const btn = e.target.closest('[data-save]');
      const changes = {};
      const resets = [];
      for (const f of section.fields) {
        let v = read(f);
        if (f.type === 'phone' && String(v).replace(/\D/g, '').length < 10) return toast(`${f.label}: enter a full phone number with country code.`, 'bad');
        if (f.type === 'lines' && v.every((l) => !l)) v = f.default;
        if (same(v, f.default)) {
          if (f.key in saved) resets.push(f.key);
        } else if (!same(v, saved[f.key])) changes[f.key] = v;
      }
      btn.disabled = true;
      try {
        await api.content.save(changes);
        await api.content.reset(resets);
        const keep = store.data.content.filter((r) => !(r.key in changes) && !resets.includes(r.key));
        store.set('content', [...keep, ...Object.entries(changes).map(([key, value]) => ({ key, value }))]);
        setDirty(false);
        toast(`${section.title} saved. The site shows it now.`);
        content({ page, params, store, guard, setTitle });
      } catch (err) {
        toast(err.message, 'bad');
        btn.disabled = false;
      }
    }
  });
}

/* ================================================================== films */

const filmState = { cat: 'all' };

export async function films({ page, store, setTitle }) {
  const products = await store.get('products');
  let list = await allFilms(store);
  setTitle('Films', 'The Blogs Raza page, and the films on fragrance pages.', `<a class="btn" href="/blogs" target="_blank" rel="noopener">${icon('eye')}Blogs page</a><button class="btn btn--gold" type="button" data-upload>${icon('upload')}Upload a film</button>`);
  const productName = (id) => products.find((p) => p.id === id)?.name;
  const productOptions = (sel) => `<option value="">— None —</option>${[...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name)} (${esc(p.category)})</option>`).join('')}`;

  const render = () => {
    const shown = list.filter((f) => filmState.cat === 'all' || f.category === filmState.cat);
    page.innerHTML = `
      <div class="toolbar"><div class="tabs">${[{ key: 'all', label: 'All' }, ...CATEGORIES].map((c) => `<button type="button" class="tab${filmState.cat === c.key ? ' is-on' : ''}" data-cat="${c.key}">${esc(c.label)}<small>${c.key === 'all' ? list.length : list.filter((f) => f.category === c.key).length}</small></button>`).join('')}</div></div>
      <div class="films">${shown.map((f) => `
        <article class="card film${f.active ? '' : ' is-hidden'}" data-slug="${esc(f.slug)}">
          <button type="button" class="film__poster" data-edit style="display:block;width:100%">
            <img src="${esc(f.poster_url)}" alt="" loading="lazy" />
            ${f.featured ? `<span class="badge badge--gold">${icon('star')}Featured</span>` : !f.active ? '<span class="badge badge--warn">Hidden</span>' : !f.bundled ? '<span class="badge badge--info">Uploaded</span>' : ''}
          </button>
          <div class="film__body"><b>${esc(f.title)}</b><p class="dim">${esc(CAT[f.category] || f.category)}${f.duration ? ` · ${Math.round(f.duration)} s` : ''}</p>${f.product_id ? `<p class="muted" style="margin-top:4px">${icon('link')} ${esc(productName(f.product_id) || f.product_id)}</p>` : ''}</div>
        </article>`).join('') || '<div class="empty"><b>No films here</b></div>'}</div>`;
  };

  const edit = (f) => {
    const d = drawer({
      title: f ? f.title : 'Upload a film',
      body: `<form class="stack" data-form>
        ${f ? `<video src="${esc(f.video)}" poster="${esc(f.poster_url)}" controls playsinline style="width:100%;max-height:52vh;border-radius:10px;background:#000"></video>` : `
          <label class="drop" data-drop>${icon('upload')}<span><b>Choose a video</b><br />MP4, up to 50 MB. Vertical (9:16) films look best.</span><input type="file" accept="video/mp4,video/webm,video/quicktime" data-file /></label>
          <p class="hint" data-picked></p><div class="progress" data-progress hidden><i></i></div>`}
        <label class="field"><span>Title</span><input class="input" name="title" value="${esc(f?.title || '')}" maxlength="80" required /></label>
        <label class="field"><span>One line about it</span><textarea class="textarea" name="text" maxlength="200" style="min-height:70px">${esc(f?.text || '')}</textarea></label>
        <div class="grid2">
          <label class="field"><span>Category</span><select class="select" name="category">${CATEGORIES.map((c) => `<option value="${c.key}"${c.key === (f?.category || 'films') ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
          <label class="field"><span>Order</span><input class="input" name="sort" type="number" value="${f?.sort ?? 0}" /></label>
        </div>
        <label class="field"><span>Shows a fragrance <small>(adds “Shop this fragrance” and puts the film on its product page)</small></span><select class="select" name="product_id">${productOptions(f?.product_id)}</select></label>
        <label class="switch"><input type="checkbox" name="featured"${f?.featured ? ' checked' : ''} /><i></i>Featured (leads the Blogs page)</label>
        <label class="switch"><input type="checkbox" name="active"${f ? (f.active ? ' checked' : '') : ' checked'} /><i></i>Show on the site</label>
      </form>`,
      foot: `${f && (!f.bundled || f.edited) ? `<button class="btn btn--danger" type="button" data-remove>${f.bundled ? 'Undo my changes' : 'Delete'}</button>` : ''}<span class="spacer"></span><button class="btn" type="button" data-close>Cancel</button><button class="btn btn--gold" type="button" data-save>${f ? 'Save' : 'Upload & publish'}</button>`,
    });
    const form = $('[data-form]', d.el);
    let file = null;
    $('[data-file]', d.el)?.addEventListener('change', (e) => {
      file = e.target.files[0] || null;
      if (file && file.size > 50 * 1024 * 1024) {
        file = null;
        return toast('That video is over 50 MB. Export a smaller MP4.', 'bad');
      }
      $('[data-picked]', d.el).textContent = file ? `${file.name} · ${bytes(file.size)}` : '';
      if (file && !form.title.value) form.title.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    });
    d.el.querySelector('.drawer__foot [data-close]')?.addEventListener('click', d.close);
    $('[data-remove]', d.el)?.addEventListener('click', async () => {
      if (!(await confirmBox({ title: f.bundled ? 'Undo your changes?' : `Delete “${f.title}”?`, text: f.bundled ? 'The film goes back to how it was bundled with the site.' : 'It disappears from the site.', ok: f.bundled ? 'Undo changes' : 'Delete', danger: true }))) return;
      try {
        await api.films.remove(f.slug);
        store.set('films', (store.data.films || []).filter((x) => x.slug !== f.slug));
        list = await allFilms(store);
        d.close();
        render();
        toast(f.bundled ? 'Film reset.' : 'Film deleted.');
      } catch (err) {
        toast(err.message, 'bad');
      }
    });
    $('[data-save]', d.el).addEventListener('click', async (e) => {
      const btn = e.target;
      const title = form.title.value.trim();
      if (title.length < 2) return toast('Give the film a title.', 'bad');
      if (!f && !file) return toast('Choose a video to upload.', 'bad');
      const row = {
        slug: f?.slug || `${slug(title) || 'film'}-${uid().slice(-4)}`,
        title, text: form.text.value.trim() || null, category: form.category.value, product_id: form.product_id.value || null,
        featured: form.featured.checked, active: form.active.checked, sort: Number(form.sort.value) || 0,
        // bundled films keep their own files; uploaded ones keep theirs
        video_url: f && !f.bundled ? f.video_url : null,
        poster_url: f && !f.bundled ? f.poster_url : null,
        duration: f && !f.bundled ? f.duration : null,
      };
      btn.disabled = true;
      try {
        if (file) {
          const bar = $('[data-progress]', d.el);
          bar.hidden = false;
          btn.textContent = 'Preparing…';
          const info = await videoInfo(file);
          bar.firstElementChild.style.width = '15%';
          btn.textContent = 'Uploading…';
          const ext = file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4';
          row.poster_url = await api.media.upload(`films/${row.slug}.webp`, info.poster, 'image/webp');
          bar.firstElementChild.style.width = '30%';
          row.video_url = await api.media.upload(`films/${row.slug}.${ext}`, file, file.type || 'video/mp4');
          bar.firstElementChild.style.width = '100%';
          row.duration = info.duration;
        }
        const saved = await api.films.save(row);
        const rest = (store.data.films || []).filter((x) => x.slug !== row.slug);
        store.set('films', [...rest, { ...row, ...saved }]);
        list = await allFilms(store);
        d.close();
        render();
        toast(f ? `“${title}” saved.` : `“${title}” uploaded. It’s on the Blogs page now.`);
      } catch (err) {
        toast(err.message, 'bad');
        btn.disabled = false;
        btn.textContent = f ? 'Save' : 'Upload & publish';
      }
    });
  };

  page.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      filmState.cat = cat.dataset.cat;
      return render();
    }
    const card = e.target.closest('[data-edit]');
    if (card) edit(list.find((f) => f.slug === card.closest('[data-slug]').dataset.slug));
  });
  $('[data-upload]').addEventListener('click', () => edit(null));
  render();
}

/* ================================================================== media */

export async function media({ page, params, setTitle, go }) {
  const prefix = (params[0] || '').replace(/^\/|\/$/g, '');
  setTitle('Media library', 'Photos and films uploaded from the admin panel.', `<label class="btn btn--gold">${icon('upload')}Upload<input type="file" accept="image/*,video/mp4" multiple hidden data-file /></label>`);
  const crumbs = ['', ...prefix.split('/').filter(Boolean)];
  let items = [];
  const render = () => {
    page.innerHTML = `
      <p class="row" style="margin-bottom:16px">${crumbs.map((c, i) => {
        const path = crumbs.slice(1, i + 1).join('/');
        return `<a href="#/media/${path}" class="${i === crumbs.length - 1 ? 'muted' : ''}">${i === 0 ? 'All files' : esc(c)}</a>`;
      }).join('<span class="dim">/</span>')}</p>
      ${items.length ? `<div class="media">${items.map((m) => (m.folder
        ? `<a class="card media-item linkish" href="#/media/${esc(m.path)}"><div class="folder">${icon('folder')}</div><div class="meta">${esc(m.name)}</div></a>`
        : `<article class="card media-item" data-path="${esc(m.path)}"><div class="thumbbox">${/^video/.test(m.type) || /\.(mp4|webm|mov)$/i.test(m.name) ? `<video src="${esc(m.url)}" muted preload="metadata"></video>` : `<img src="${esc(m.url)}" alt="" loading="lazy" />`}</div>
            <div class="meta">${esc(m.name)}<br />${m.size ? bytes(m.size) : ''}<div class="row" style="margin-top:6px"><button class="btn btn--sm" type="button" data-copy>${icon('copy')}Link</button><button class="icon-btn" type="button" data-del aria-label="Delete">${icon('trash')}</button></div></div></article>`)).join('')}</div>`
        : `<div class="empty"><b>Nothing uploaded here yet</b>Photos you add to fragrances and films you upload are stored here.${api.mode === 'demo' ? '<br />In the demo, uploads last until you close this tab.' : ''}</div>`}`;
  };
  const load = async () => {
    try {
      items = await api.media.list(prefix);
    } catch (err) {
      toast(err.message, 'bad');
      items = [];
    }
    render();
  };
  page.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-path]');
    if (!item) return;
    const m = items.find((x) => x.path === item.dataset.path);
    if (e.target.closest('[data-copy]')) {
      await navigator.clipboard?.writeText(m.url);
      toast('Link copied.', 'info');
    } else if (e.target.closest('[data-del]')) {
      if (!(await confirmBox({ title: `Delete ${m.name}?`, text: 'If a fragrance or film still uses it, that picture will go blank. Remove it there first.', ok: 'Delete', danger: true }))) return;
      try {
        await api.media.remove([m.path]);
        toast('Deleted.');
        load();
      } catch (err) {
        toast(err.message, 'bad');
      }
    }
  });
  $('[data-file]').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    const folder = prefix || 'uploads';
    for (const file of files) {
      try {
        if (file.type.startsWith('image/')) {
          const { blob } = await toWebp(file, 2000);
          await api.media.upload(`${folder}/${slug(file.name.replace(/\.[^.]+$/, '')) || uid()}-${uid().slice(-4)}.webp`, blob, 'image/webp');
        } else {
          await api.media.upload(`${folder}/${slug(file.name.replace(/\.[^.]+$/, '')) || uid()}-${uid().slice(-4)}.mp4`, file, file.type || 'video/mp4');
        }
      } catch (err) {
        toast(`${file.name}: ${err.message}`, 'bad');
      }
    }
    toast(`${files.length} file${files.length === 1 ? '' : 's'} uploaded.`);
    if (!prefix) go('#/media/uploads');
    else load();
  });
  load();
}

/* =============================================================== settings */

export async function settings({ page, store, setTitle }) {
  setTitle('Settings');
  const session = await api.auth.session();
  const me = session?.user?.email || '';
  const admins = await api.admins.list().catch(() => []);
  const render = () => {
    page.innerHTML = `
      <div class="stack" style="max-width:860px">
        <section class="card"><header class="card__head"><div><h2>Connection</h2><p>${api.mode === 'demo' ? 'Demo mode: nothing here changes the live site.' : 'Connected to Supabase. Changes publish to the live site.'}</p></div>
          <span class="badge ${api.mode === 'demo' ? 'badge--info' : 'badge--ok'}" style="margin-left:auto">${api.mode === 'demo' ? 'Demo' : 'Live'}</span></header>
          <div class="card__body stack">
            ${api.mode === 'demo' ? `
              <p><b>Going live takes about 10 minutes:</b></p>
              <ol style="padding-left:20px;display:grid;gap:8px" class="muted">
                <li>In <b>Supabase → SQL Editor</b>, run <code>supabase/schema.sql</code>, then <code>supabase/seed.sql</code> (both are in the project).</li>
                <li>Still in the SQL Editor, add the owner as the first admin:<br /><code>insert into public.admins (email) values ('owner@example.com');</code></li>
                <li>In <b>Authentication → Users → Add user</b>, create that same email with a password (tick “Auto confirm”). Under <b>Authentication → Sign In / Providers</b>, turn off “Allow new users to sign up”.</li>
                <li>In <b>Project Settings → API Keys</b>, copy the Publishable key. In <b>Vercel → Settings → Environment Variables</b>, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy.</li>
                <li>Open <b>/admin</b> and sign in. Everything you edit here then goes live.</li>
              </ol>` : `<dl class="kv"><dt>Project</dt><dd>${esc(SHOP.supabaseUrl)}</dd><dt>Signed in as</dt><dd>${esc(me)}</dd></dl>`}
          </div>
        </section>
        <section class="card"><header class="card__head"><div><h2>Admins</h2><p>People who can sign in here and change the site.</p></div></header>
          <div class="card__body stack">
            <table class="table">${admins.map((a) => `<tr><td>${esc(a.email)}${a.email === me ? ' <span class="badge badge--gold badge--plain">You</span>' : ''}</td><td class="dim">added ${ago(a.added_at)}</td><td style="text-align:right">${a.email === me ? '' : `<button class="btn btn--sm btn--danger" type="button" data-remove="${esc(a.email)}">Remove</button>`}</td></tr>`).join('')}</table>
            <form class="row" data-add><input class="input" type="email" name="email" placeholder="name@example.com" required style="flex:1;min-width:220px" /><button class="btn" type="submit">${icon('plus')}Add admin</button></form>
            <p class="hint">Then create their account in Supabase → Authentication → Users → Add user (same email). They sign in at /admin.</p>
          </div>
        </section>
        ${api.mode === 'demo' ? '' : `<section class="card"><header class="card__head"><h2>Your password</h2></header><div class="card__body"><form class="row" data-password><input class="input" type="password" name="password" placeholder="New password (8+ characters)" autocomplete="new-password" minlength="8" style="flex:1;min-width:220px" /><button class="btn" type="submit">Change password</button></form></div></section>`}
        <section class="card"><header class="card__head"><div><h2>Bulk import from the spreadsheet</h2><p>For loading many products or prices at once.</p></div></header>
          <div class="card__body muted">Fill the prices in <code>src/lib/SHOP NX2 ONLINE LIST.xlsx</code>, run <code>npm run import:products</code>, then run the new <code>supabase/seed.sql</code> in the SQL Editor. Prices typed in the sheet replace the ones here; empty cells keep what you set here; photos and descriptions from the panel are never overwritten.</div>
        </section>
      </div>`;
  };
  page.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.matches('[data-add]')) {
        await api.admins.add(f.email.value);
        admins.push({ email: f.email.value.trim().toLowerCase(), added_at: new Date().toISOString() });
        toast(`${f.email.value} added as an admin.`);
        render();
      } else if (f.matches('[data-password]')) {
        if (f.password.value.length < 8) return toast('Use at least 8 characters.', 'bad');
        await api.auth.setPassword(f.password.value);
        f.reset();
        toast('Password changed.');
      }
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
  page.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    if (!(await confirmBox({ title: `Remove ${b.dataset.remove}?`, text: 'They won’t be able to change the site any more.', ok: 'Remove', danger: true }))) return;
    try {
      await api.admins.remove(b.dataset.remove);
      admins.splice(admins.findIndex((a) => a.email === b.dataset.remove), 1);
      toast('Admin removed.');
      render();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
  render();
}
