import { api, normaliseSizes, slug, fromPrice, TYPE_LABEL } from '../api.js';
import { $, $$, esc, icon, toast, confirmBox, rupees, ago, toWebp, uid, parsePrice } from '../ui.js';
import { allFilms } from '../films-data.js';

// Products: the list, the editor, and the price list (every size of every
// fragrance in one grid).

export const COLLECTIONS = [
  { key: 'luxury', label: 'Luxury' },
  { key: 'premium', label: 'Premium' },
  { key: 'regular', label: 'Regular' },
  { key: 'house', label: 'House signature' },
];
const CAT = Object.fromEntries(COLLECTIONS.map((c) => [c.key, c.label]));
export const STANDARD_SIZES = [
  { type: 'perfume', ml: 30 }, { type: 'perfume', ml: 50 }, { type: 'perfume', ml: 100 },
  { type: 'attar', ml: 6 }, { type: 'attar', ml: 12 },
];
export const thumbOf = (p) => p.images?.[0]?.sm || p.images?.[0]?.lg || `/media/products/${p.id}.webp`;
const clone = (x) => JSON.parse(JSON.stringify(x));

// "₹150 – ₹900", "On request", "3 of 5 priced"
function priceSummary(p) {
  if (!p.variants?.length) return p.price != null ? `<span class="num">${rupees(p.price)}</span>` : '<span class="badge badge--warn">On request</span>';
  const prices = p.variants.map((v) => v.price).filter((n) => n != null);
  if (!prices.length) return '<span class="badge badge--warn">On request</span>';
  const range = `${rupees(Math.min(...prices))}${prices.length > 1 && Math.max(...prices) !== Math.min(...prices) ? ` – ${rupees(Math.max(...prices))}` : ''}`;
  return prices.length < p.variants.length
    ? `<span class="num">${range}</span> <span class="badge badge--warn badge--plain">${prices.length} of ${p.variants.length} sizes</span>`
    : `<span class="num">${range}</span>`;
}
const unpriced = (p) => (p.variants?.length ? p.variants.some((v) => v.price == null) : p.price == null);
const noPhoto = (p) => !p.images?.length;

/* ================================================================ list */

const listState = { q: '', cat: 'all', status: 'all', selected: new Set() };

export async function products({ page, store, setTitle }) {
  const all = await store.get('products');
  setTitle('Products', `${all.length} fragrances`, `<a class="btn" href="#/prices">${icon('tag')}Price list</a><a class="btn btn--gold" href="#/products/new">${icon('plus')}Add fragrance</a>`);
  const STATUS = [
    ['all', 'All'], ['visible', 'On the site'], ['hidden', 'Hidden'], ['featured', 'Featured'],
    ['unpriced', 'Price on request'], ['nophoto', 'No photo'],
  ];
  const test = {
    all: () => true, visible: (p) => p.active, hidden: (p) => !p.active, featured: (p) => p.featured,
    unpriced, nophoto: noPhoto,
  };
  const matches = (p) => {
    const q = listState.q.trim().toLowerCase();
    return (listState.cat === 'all' || p.category === listState.cat)
      && test[listState.status](p)
      && (!q || p.name.toLowerCase().includes(q) || (p.sheet_name || '').toLowerCase().includes(q) || String(p.number) === q);
  };

  page.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<span class="sr-only">Search</span><input class="input" type="search" placeholder="Search by name or number" value="${esc(listState.q)}" data-q /></label>
      <div class="tabs" data-cats></div>
      <select class="select" style="width:auto" data-status aria-label="Show">${STATUS.map(([k, l]) => `<option value="${k}"${k === listState.status ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div data-bulk></div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th class="check"><input type="checkbox" data-all aria-label="Select all shown" /></th><th>Fragrance</th><th class="hide-sm">Collection</th><th>Price</th><th class="hide-sm">Photos</th><th>On site</th><th>Featured</th><th></th></tr></thead>
      <tbody data-rows></tbody>
    </table></div></div>`;

  const rowsEl = $('[data-rows]', page);
  const render = () => {
    const list = store.data.products.filter(matches);
    $('[data-cats]', page).innerHTML = [{ key: 'all', label: 'All' }, ...COLLECTIONS].map((c) => {
      const n = c.key === 'all' ? store.data.products.length : store.data.products.filter((p) => p.category === c.key).length;
      return n || c.key === 'all' ? `<button type="button" class="tab${listState.cat === c.key ? ' is-on' : ''}" data-cat="${c.key}">${esc(c.label)}<small>${n}</small></button>` : '';
    }).join('');
    rowsEl.innerHTML = list.length ? list.map((p) => `
      <tr class="${p.active ? '' : 'is-hidden'}${listState.selected.has(p.id) ? ' is-selected' : ''}" data-id="${esc(p.id)}">
        <td class="check"><input type="checkbox" data-pick${listState.selected.has(p.id) ? ' checked' : ''} aria-label="Select ${esc(p.name)}" /></td>
        <td><a class="prod linkish" href="#/products/${encodeURIComponent(p.id)}"><img class="thumb" src="${esc(thumbOf(p))}" alt="" loading="lazy" /><span><b>${esc(p.name)}</b><small>No. ${String(p.number).padStart(2, '0')}${p.inspired ? ' · Inspired' : ''}</small></span></a></td>
        <td class="hide-sm"><span class="dot dot--${p.category}"></span> ${esc(CAT[p.category] || p.category)}</td>
        <td>${priceSummary(p)}</td>
        <td class="hide-sm">${p.images?.length ? `<span class="num">${p.images.length}</span>` : '<span class="dim">—</span>'}</td>
        <td><label class="switch"><input type="checkbox" data-active${p.active ? ' checked' : ''} aria-label="Show ${esc(p.name)} on the site" /><i></i></label></td>
        <td><button type="button" class="icon-btn${p.featured ? ' is-on' : ''}" data-feature aria-pressed="${p.featured}" aria-label="Feature ${esc(p.name)}">${icon('star')}</button></td>
        <td><a class="icon-btn" href="#/products/${encodeURIComponent(p.id)}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</a></td>
      </tr>`).join('') : '<tr><td colspan="8"><div class="empty"><b>Nothing here</b>No fragrance matches this search or filter.</div></td></tr>';
    const shown = list.map((p) => p.id);
    $('[data-all]', page).checked = shown.length > 0 && shown.every((id) => listState.selected.has(id));
    renderBulk();
  };
  const renderBulk = () => {
    const n = listState.selected.size;
    $('[data-bulk]', page).innerHTML = n ? `<div class="bulk"><b>${n} selected</b>
      <button class="btn btn--sm" type="button" data-bulk-set="active:true">${icon('eye')}Show on site</button>
      <button class="btn btn--sm" type="button" data-bulk-set="active:false">${icon('eyeOff')}Hide</button>
      <button class="btn btn--sm" type="button" data-bulk-set="featured:true">${icon('star')}Feature</button>
      <button class="btn btn--sm" type="button" data-bulk-set="featured:false">Unfeature</button>
      <a class="btn btn--sm" href="#/prices" data-bulk-prices>${icon('tag')}Set prices</a>
      <span class="spacer"></span><button class="btn btn--sm btn--ghost" type="button" data-bulk-clear>Clear</button></div>` : '';
  };

  const patch = async (ids, change, message) => {
    try {
      await api.products.update(ids, change);
      store.set('products', store.data.products.map((p) => (ids.includes(p.id) ? { ...p, ...change } : p)));
      toast(message);
    } catch (err) {
      toast(err.message, 'bad');
    }
    render();
  };

  page.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) {
      listState.q = e.target.value;
      render();
    }
  });
  page.addEventListener('change', (e) => {
    const t = e.target;
    const id = t.closest('[data-id]')?.dataset.id;
    if (t.matches('[data-status]')) {
      listState.status = t.value;
      render();
    } else if (t.matches('[data-pick]')) {
      if (t.checked) listState.selected.add(id);
      else listState.selected.delete(id);
      t.closest('tr').classList.toggle('is-selected', t.checked);
      renderBulk();
    } else if (t.matches('[data-all]')) {
      store.data.products.filter(matches).forEach((p) => (t.checked ? listState.selected.add(p.id) : listState.selected.delete(p.id)));
      render();
    } else if (t.matches('[data-active]')) {
      const p = store.data.products.find((x) => x.id === id);
      patch([id], { active: t.checked }, t.checked ? `${p.name} is on the site.` : `${p.name} is hidden from the site.`);
    }
  });
  page.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      listState.cat = cat.dataset.cat;
      return render();
    }
    const star = e.target.closest('[data-feature]');
    if (star) {
      const id = star.closest('[data-id]').dataset.id;
      const p = store.data.products.find((x) => x.id === id);
      return patch([id], { featured: !p.featured }, p.featured ? `${p.name} is no longer featured.` : `${p.name} is featured: it leads the shop.`);
    }
    const bulk = e.target.closest('[data-bulk-set]');
    if (bulk) {
      const [key, v] = bulk.dataset.bulkSet.split(':');
      const ids = [...listState.selected];
      return patch(ids, { [key]: v === 'true' }, `${ids.length} fragrance${ids.length === 1 ? '' : 's'} updated.`);
    }
    if (e.target.closest('[data-bulk-prices]')) {
      pricesState.only = new Set(listState.selected);
      return;
    }
    if (e.target.closest('[data-bulk-clear]')) {
      listState.selected.clear();
      render();
    }
  });
  render();
}

/* ============================================================== editor */

export async function productEditor({ page, params, store, guard, setTitle, go }) {
  const all = await store.get('products');
  const isNew = params[0] === 'new';
  const saved = isNew ? null : all.find((p) => p.id === params[0]);
  if (!isNew && !saved) {
    setTitle('Not found');
    page.innerHTML = '<div class="empty"><b>This fragrance isn’t in the catalogue</b><a href="#/products">Back to products</a></div>';
    return;
  }
  const next = (cat) => Math.max(0, ...store.data.products.filter((p) => p.category === cat).map((p) => p.number)) + 1;
  const draft = saved ? clone(saved) : {
    id: null, name: '', sheet_name: null, category: 'regular', number: next('regular'), inspired: false, description: '',
    variants: normaliseSizes(STANDARD_SIZES), images: [], active: true, featured: false, stock: null, price: null,
  };
  // sizes as editable rows (price text as typed)
  let sizes = draft.variants.map((v) => ({ type: v.type || '', ml: v.ml, price: v.price ?? '' }));
  const films = draft.id ? (await allFilms(store)).filter((f) => f.product_id === draft.id) : [];

  setTitle(isNew ? 'Add a fragrance' : draft.name, isNew ? '' : `Last saved ${ago(draft.updated_at || new Date().toISOString())}`,
    `<a class="btn" href="#/products">${icon('left')}All products</a>${isNew ? '' : `<a class="btn" href="/p/${encodeURIComponent(draft.id)}" target="_blank" rel="noopener">${icon('eye')}View on site</a>`}`);

  page.innerHTML = `
    <div class="editor">
      <div class="stack">
        <section class="card"><header class="card__head"><h2>Details</h2></header><div class="card__body stack">
          <label class="field"><span>Name</span><input class="input" name="name" value="${esc(draft.name)}" maxlength="80" required placeholder="e.g. Rasasi Hawas" /></label>
          <div class="grid3">
            <label class="field"><span>Collection</span><select class="select" name="category">${COLLECTIONS.map((c) => `<option value="${c.key}"${c.key === draft.category ? ' selected' : ''}>${c.label}</option>`).join('')}</select></label>
            <label class="field"><span>Number</span><input class="input" name="number" type="number" min="0" step="1" value="${esc(draft.number)}" /></label>
            <label class="field"><span>Stock <small>(optional)</small></span><input class="input" name="stock" type="number" min="0" step="1" value="${draft.stock ?? ''}" placeholder="Not tracked" /></label>
          </div>
          <label class="field"><span>Description <small>shown in the product view</small></span><textarea class="textarea" name="description" maxlength="600" placeholder="A few words about the scent: its character, notes, when to wear it.">${esc(draft.description || '')}</textarea></label>
          <label class="switch"><input type="checkbox" name="inspired"${draft.inspired ? ' checked' : ''} /><i></i>Inspired by another house (shows the “Inspired” tag)</label>
        </div></section>

        <section class="card"><header class="card__head"><div><h2>Sizes &amp; prices</h2><p>Leave a price empty for “price on request”. Customers can still choose that size and ask on WhatsApp.</p></div></header>
          <div class="card__body">
            <table class="sizes"><thead><tr><th>Kind</th><th>Size (ml)</th><th>Price (₹)</th><th></th></tr></thead><tbody data-sizes></tbody></table>
            <div class="row" style="margin-top:12px">
              <button class="btn btn--sm" type="button" data-add-size>${icon('plus')}Add a size</button>
              <button class="btn btn--sm btn--ghost" type="button" data-standard>Use the standard sizes (Perfume 30/50/100, Attar 6/12)</button>
            </div>
          </div>
        </section>
        ${films.length ? `<section class="card"><header class="card__head"><h2>Films of this fragrance</h2></header><div class="card__body">${films.map((f) => `<p>${icon('film')} ${esc(f.title)}</p>`).join('')}<p class="hint" style="margin-top:8px">Manage them under <a href="#/films">Films</a>.</p></div></section>` : ''}
      </div>

      <div class="stack">
        <section class="card"><header class="card__head"><div><h2>Photos</h2><p>The first photo is the cover. Drag to reorder.</p></div></header>
          <div class="card__body stack">
            <div class="photos" data-photos></div>
            <label class="drop" data-drop>${icon('upload')}<span><b>Add photos</b><br />Drop images here or click. JPG, PNG or WebP. They’re resized for the web automatically.</span><input type="file" accept="image/*" multiple data-file /></label>
            <div class="progress" data-progress hidden><i></i></div>
          </div>
        </section>
        <section class="card"><header class="card__head"><h2>On the site</h2></header><div class="card__body stack">
          <label class="switch"><input type="checkbox" name="active"${draft.active ? ' checked' : ''} /><i></i>Show on the site</label>
          <label class="switch"><input type="checkbox" name="featured"${draft.featured ? ' checked' : ''} /><i></i>Featured (leads the shop)</label>
        </div></section>
        <section class="card"><header class="card__head"><h2>Preview</h2></header><div class="card__body"><div class="preview-card" data-preview></div></div></section>
        ${isNew ? '' : `<section class="card"><header class="card__head"><h2>Remove</h2></header><div class="card__body row"><p class="muted" style="flex:1">Hiding keeps it for past orders and lets you bring it back. Deleting is permanent.</p><button class="btn btn--danger" type="button" data-delete>${icon('trash')}Delete</button></div></section>`}
      </div>
    </div>
    <div class="savebar" data-savebar><p>Unsaved changes</p><span class="spacer"></span><button class="btn" type="button" data-discard>Discard</button><button class="btn btn--gold" type="button" data-save>${isNew ? 'Add fragrance' : 'Save changes'}</button></div>`;

  const form = (name) => $(`[name="${name}"]`, page);
  const dirty = (on = true) => {
    guard.dirty = on;
    $('[data-savebar]', page).classList.toggle('is-on', on);
  };

  const renderSizes = () => {
    $('[data-sizes]', page).innerHTML = sizes.map((s, i) => `
      <tr data-i="${i}">
        <td><select class="select input--sm" data-f="type" aria-label="Kind">${[['perfume', 'Perfume'], ['attar', 'Attar'], ['', 'Other']].map(([v, l]) => `<option value="${v}"${(s.type || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><input class="input input--sm" data-f="ml" type="number" min="1" step="1" value="${esc(s.ml)}" aria-label="Size in ml" /></td>
        <td><input class="input input--sm" data-f="price" inputmode="decimal" value="${esc(s.price)}" placeholder="On request" aria-label="Price" /></td>
        <td><button class="icon-btn" type="button" data-remove-size aria-label="Remove this size">${icon('x')}</button></td>
      </tr>`).join('') || '<tr><td colspan="4" class="dim">No sizes: sold in one size at one price. Add a size to offer choices.</td></tr>';
  };
  const renderPhotos = () => {
    $('[data-photos]', page).innerHTML = draft.images.map((im, i) => `
      <figure class="photo${im.kind === 'card' ? ' is-card' : ''}" draggable="true" data-p="${i}">
        <img src="${esc(im.sm || im.lg)}" alt="" />
        ${i === 0 ? '<span class="photo__cover">Cover</span>' : ''}
        <figcaption class="photo__tools">
          <button class="icon-btn" type="button" data-move="-1" aria-label="Move left"${i === 0 ? ' disabled' : ''}>${icon('left')}</button>
          <button class="icon-btn${im.kind === 'card' ? ' is-on' : ''}" type="button" data-card aria-pressed="${im.kind === 'card'}" title="Show whole (for designed cards with text)" aria-label="Show whole">${icon('cardIcon')}</button>
          <button class="icon-btn" type="button" data-drop-photo aria-label="Remove photo">${icon('trash')}</button>
          <button class="icon-btn" type="button" data-move="1" aria-label="Move right"${i === draft.images.length - 1 ? ' disabled' : ''}>${icon('right')}</button>
        </figcaption>
      </figure>`).join('') || '<p class="dim" style="grid-column:1/-1">No photos yet: the site shows the studio render of the Raza bottle.</p>';
  };
  const renderPreview = () => {
    const variants = normaliseSizes(sizes.map((s) => ({ ...s, price: parsePrice(s.price) })));
    const from = fromPrice({ variants, price: null });
    $('[data-preview]', page).innerHTML = `<img src="${esc(draft.images[0]?.sm || (draft.id ? `/media/products/${draft.id}.webp` : '/media/products/house-base.webp'))}" alt="" /><div><b>${esc(form('name').value || 'New fragrance')}</b><p class="muted">${esc(CAT[form('category').value])} collection${form('inspired').checked ? ' · Inspired' : ''}</p><p class="num" style="margin-top:6px;color:var(--gold-hi)">${from != null ? `From ${rupees(from)}` : 'Price on request'}</p>${form('active').checked ? '' : '<p class="badge badge--warn" style="margin-top:8px">Hidden</p>'}</div>`;
  };
  renderSizes();
  renderPhotos();
  renderPreview();

  page.addEventListener('input', (e) => {
    const row = e.target.closest('[data-i]');
    if (row && e.target.dataset.f) sizes[Number(row.dataset.i)][e.target.dataset.f] = e.target.value;
    dirty();
    renderPreview();
  });
  page.addEventListener('change', (e) => {
    if (e.target === form('category') && isNew) form('number').value = next(e.target.value);
    dirty();
    renderPreview();
  });
  page.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-add-size]')) {
      sizes.push({ type: 'perfume', ml: '', price: '' });
      renderSizes();
      dirty();
      $$('[data-f="ml"]', page).at(-1)?.focus();
    } else if (t.closest('[data-standard]')) {
      const old = new Map(sizes.map((s) => [`${s.type}-${s.ml}`, s.price]));
      sizes = STANDARD_SIZES.map((s) => ({ ...s, price: old.get(`${s.type}-${s.ml}`) ?? '' }));
      renderSizes();
      dirty();
      renderPreview();
    } else if (t.closest('[data-remove-size]')) {
      sizes.splice(Number(t.closest('[data-i]').dataset.i), 1);
      renderSizes();
      dirty();
      renderPreview();
    } else if (t.closest('[data-move]')) {
      const i = Number(t.closest('[data-p]').dataset.p);
      const j = i + Number(t.closest('[data-move]').dataset.move);
      [draft.images[i], draft.images[j]] = [draft.images[j], draft.images[i]];
      renderPhotos();
      dirty();
      renderPreview();
    } else if (t.closest('[data-card]')) {
      const im = draft.images[Number(t.closest('[data-p]').dataset.p)];
      im.kind = im.kind === 'card' ? 'photo' : 'card';
      renderPhotos();
      dirty();
    } else if (t.closest('[data-drop-photo]')) {
      draft.images.splice(Number(t.closest('[data-p]').dataset.p), 1);
      renderPhotos();
      dirty();
      renderPreview();
    } else if (t.closest('[data-discard]')) {
      dirty(false);
      if (isNew) go('#/products');
      else productEditor({ page, params, store, guard, setTitle, go });
    } else if (t.closest('[data-save]')) {
      save(t.closest('[data-save]'));
    } else if (t.closest('[data-delete]')) {
      const okay = await confirmBox({ title: `Delete ${draft.name}?`, text: 'It disappears from the site for good. If it was ever ordered it can only be hidden, not deleted.', ok: 'Delete', danger: true });
      if (!okay) return;
      try {
        await api.products.remove(draft.id);
        store.set('products', store.data.products.filter((p) => p.id !== draft.id));
        dirty(false);
        toast(`${draft.name} deleted.`);
        go('#/products');
      } catch (err) {
        toast(err.message, 'bad');
      }
    }
  });

  // photos: drag to reorder, drop files to upload
  let from = null;
  const grid = $('[data-photos]', page);
  grid.addEventListener('dragstart', (e) => {
    from = Number(e.target.closest('[data-p]')?.dataset.p);
    e.target.closest('[data-p]')?.classList.add('is-drag');
  });
  grid.addEventListener('dragend', () => $$('.photo', grid).forEach((p) => p.classList.remove('is-drag', 'is-over')));
  grid.addEventListener('dragover', (e) => {
    const over = e.target.closest('[data-p]');
    if (from == null || !over) return;
    e.preventDefault();
    $$('.photo', grid).forEach((p) => p.classList.toggle('is-over', p === over));
  });
  grid.addEventListener('drop', (e) => {
    const over = e.target.closest('[data-p]');
    if (from == null || !over) return;
    e.preventDefault();
    const [moved] = draft.images.splice(from, 1);
    draft.images.splice(Number(over.dataset.p), 0, moved);
    from = null;
    renderPhotos();
    dirty();
    renderPreview();
  });
  const drop = $('[data-drop]', page);
  drop.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    upload([...e.dataTransfer.files]);
  });
  $('[data-file]', page).addEventListener('change', (e) => upload([...e.target.files]));

  async function upload(files) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return toast('Choose image files (JPG, PNG or WebP).', 'bad');
    const bar = $('[data-progress]', page);
    bar.hidden = false;
    const folder = draft.id || `new-${slug(form('name').value) || uid()}`;
    let done = 0;
    for (const file of images) {
      try {
        const [lg, sm] = await Promise.all([toWebp(file, 1600), toWebp(file, 600)]);
        const key = `products/${folder}/${uid()}`;
        const [lgUrl, smUrl] = await Promise.all([
          api.media.upload(`${key}-lg.webp`, lg.blob, 'image/webp'),
          api.media.upload(`${key}-sm.webp`, sm.blob, 'image/webp'),
        ]);
        draft.images.push({ lg: lgUrl, sm: smUrl, alt: form('name').value || draft.name, kind: 'photo' });
      } catch (err) {
        toast(`${file.name}: ${err.message}`, 'bad');
      }
      done += 1;
      bar.firstElementChild.style.width = `${(done / images.length) * 100}%`;
    }
    setTimeout(() => (bar.hidden = true), 600);
    renderPhotos();
    renderPreview();
    dirty();
    toast(`${done} photo${done === 1 ? '' : 's'} added. Save to publish.`, 'info');
  }

  async function save(btn) {
    const name = form('name').value.trim();
    if (name.length < 2) {
      form('name').focus();
      return toast('Give the fragrance a name.', 'bad');
    }
    const bad = sizes.find((s) => Number.isNaN(parsePrice(s.price)));
    if (bad) return toast(`“${bad.price}” isn’t a price. Use numbers only, or leave it empty for “on request”.`, 'bad');
    if (sizes.some((s) => !(Number(s.ml) > 0))) return toast('Every size needs its ml.', 'bad');
    const variants = normaliseSizes(sizes.map((s) => ({ ...s, price: parsePrice(s.price) })));
    if (new Set(variants.map((v) => v.id)).size !== variants.length) return toast('The same size is listed twice.', 'bad');
    const category = form('category').value;
    const id = draft.id || `${category}-${slug(name)}`;
    if (!draft.id && store.data.products.some((p) => p.id === id)) return toast(`${name} is already in the ${CAT[category]} collection.`, 'bad');
    const stock = form('stock').value === '' ? null : Math.max(0, Math.floor(Number(form('stock').value)));
    const row = {
      ...draft, id, name, category, number: Math.max(0, Math.floor(Number(form('number').value) || 0)),
      inspired: form('inspired').checked, description: form('description').value.trim() || null, stock,
      active: form('active').checked, featured: form('featured').checked, variants,
      images: draft.images.map((im) => ({ ...im, alt: im.alt || name })),
    };
    row.price = fromPrice(row);
    btn.disabled = true;
    try {
      const out = await api.products.save(row);
      const list = store.data.products.filter((p) => p.id !== id);
      store.set('products', [...list, { ...row, ...out }].sort((a, b) => a.category.localeCompare(b.category) || a.number - b.number));
      dirty(false);
      toast(isNew ? `${name} added to the ${CAT[category]} collection.` : `${name} saved. The site shows it now.`);
      if (isNew) go(`#/products/${encodeURIComponent(id)}`);
      else setTitle(name, 'Saved just now', $('[data-top] .top__actions').innerHTML);
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      btn.disabled = false;
    }
  }
}

/* ========================================================== price list */

export const pricesState = { cat: 'all', q: '', unpricedOnly: false, only: null };

export async function prices({ page, store, guard, setTitle }) {
  const all = await store.get('products');
  // the sizes across the catalogue, as columns: Perfume 30 / 50 / 100, Attar 6 / 12, …
  const colMap = new Map();
  all.forEach((p) => p.variants?.forEach((v) => colMap.set(v.id, { id: v.id, type: v.type, ml: v.ml, label: v.label })));
  const order = (c) => (c.type === 'perfume' ? 0 : c.type === 'attar' ? 1 : 2) * 10000 + c.ml;
  const cols = [...colMap.values()].sort((a, b) => order(a) - order(b));
  const edits = new Map(); // product id → { sizeId: price }

  setTitle('Price list', 'Every size of every fragrance. Empty = price on request.', '<button class="btn btn--gold" type="button" data-save-all disabled>Save prices</button>');
  const only = pricesState.only;
  pricesState.only = null; // "Set prices" from a selection applies once

  page.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<span class="sr-only">Search</span><input class="input" type="search" placeholder="Search" value="${esc(pricesState.q)}" data-q /></label>
      <div class="tabs" data-cats>${[{ key: 'all', label: 'All' }, ...COLLECTIONS.filter((c) => c.key !== 'house')].map((c) => `<button type="button" class="tab${pricesState.cat === c.key ? ' is-on' : ''}" data-cat="${c.key}">${c.label}</button>`).join('')}</div>
      <label class="switch"><input type="checkbox" data-unpriced${pricesState.unpricedOnly ? ' checked' : ''} /><i></i>Only unpriced</label>
      ${only ? `<span class="badge badge--gold badge--plain">${only.size} selected fragrances</span>` : ''}
    </div>
    <p class="hint" style="margin-bottom:12px">Type a price and press Enter to go down the column. To price a whole column at once, type in its “Fill” box and press Apply: it fills the fragrances shown below.</p>
    <div class="card"><div class="table-wrap"><table class="table pgrid">
      <thead><tr><th>Fragrance</th>${cols.map((c) => `<th class="size">${esc(c.label)}<div class="fill"><input inputmode="decimal" placeholder="Fill ₹" data-fill="${c.id}" aria-label="Fill ${esc(c.label)}" /><button class="btn btn--sm" type="button" data-apply="${c.id}">Apply</button></div></th>`).join('')}</tr></thead>
      <tbody data-rows></tbody>
    </table></div></div>`;

  const shown = () => store.data.products.filter((p) => p.category !== 'house'
    && (!only || only.has(p.id))
    && (pricesState.cat === 'all' || p.category === pricesState.cat)
    && (!pricesState.q || p.name.toLowerCase().includes(pricesState.q.toLowerCase()))
    && (!pricesState.unpricedOnly || unpriced(p)));
  const valueOf = (p, c) => {
    const e = edits.get(p.id);
    if (e && c.id in e) return e[c.id];
    const v = p.variants?.find((x) => x.id === c.id);
    return v ? (v.price ?? '') : undefined; // undefined = this fragrance isn't sold in that size
  };
  const render = () => {
    const list = shown();
    $('[data-rows]', page).innerHTML = list.length ? list.map((p) => `
      <tr data-id="${esc(p.id)}"${p.active ? '' : ' class="is-hidden"'}>
        <td><a class="prod linkish" href="#/products/${encodeURIComponent(p.id)}"><img class="thumb" src="${esc(thumbOf(p))}" alt="" loading="lazy" style="width:34px;height:34px" /><span><b>${esc(p.name)}</b><small><span class="dot dot--${p.category}"></span> ${CAT[p.category]}</small></span></a></td>
        ${cols.map((c) => {
          const v = valueOf(p, c);
          const dirtyCell = edits.get(p.id) && c.id in edits.get(p.id);
          return `<td class="cell"><input inputmode="decimal" data-col="${c.id}" value="${v === undefined ? '' : esc(v)}" placeholder="${v === undefined ? 'n/a' : '—'}" class="${dirtyCell ? 'is-dirty' : ''}" aria-label="${esc(p.name)} ${esc(c.label)}" /></td>`;
        }).join('')}
      </tr>`).join('') : `<tr><td colspan="${cols.length + 1}"><div class="empty"><b>All priced</b>No fragrance matches.</div></td></tr>`;
  };
  const markDirty = () => {
    const n = edits.size;
    guard.dirty = n > 0;
    const btn = $('[data-save-all]');
    btn.disabled = !n;
    btn.textContent = n ? `Save prices (${n} fragrance${n === 1 ? '' : 's'})` : 'Save prices';
  };
  const setCell = (id, col, value) => {
    const e = edits.get(id) || {};
    e[col] = value;
    edits.set(id, e);
  };

  page.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) {
      pricesState.q = e.target.value;
      return render();
    }
    const cell = e.target.closest('[data-col]');
    if (!cell) return;
    setCell(cell.closest('[data-id]').dataset.id, cell.dataset.col, cell.value);
    cell.classList.add('is-dirty');
    cell.classList.toggle('is-bad', Number.isNaN(parsePrice(cell.value)));
    markDirty();
  });
  page.addEventListener('keydown', (e) => {
    const cell = e.target.closest('[data-col]');
    if (!cell || e.key !== 'Enter') return;
    e.preventDefault();
    const rows = $$('[data-rows] tr', page);
    const i = rows.indexOf(cell.closest('tr')) + (e.shiftKey ? -1 : 1);
    rows[i]?.querySelector(`[data-col="${cell.dataset.col}"]`)?.focus();
    rows[i]?.querySelector(`[data-col="${cell.dataset.col}"]`)?.select();
  });
  page.addEventListener('change', (e) => {
    if (e.target.matches('[data-unpriced]')) {
      pricesState.unpricedOnly = e.target.checked;
      render();
    }
  });
  page.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      pricesState.cat = cat.dataset.cat;
      $$('[data-cat]', page).forEach((b) => b.classList.toggle('is-on', b === cat));
      return render();
    }
    const apply = e.target.closest('[data-apply]');
    if (apply) {
      const col = apply.dataset.apply;
      const v = $(`[data-fill="${col}"]`, page).value;
      if (Number.isNaN(parsePrice(v))) return toast('Type a price in the Fill box first.', 'bad');
      const list = shown();
      list.forEach((p) => setCell(p.id, col, v));
      render();
      markDirty();
      toast(`${cols.find((c) => c.id === col).label}: ${v === '' ? 'on request' : rupees(parsePrice(v))} for ${list.length} fragrances. Press “Save prices” to publish.`, 'info');
    }
  });
  $('[data-save-all]').addEventListener('click', async (e) => {
    const btn = e.target;
    const rows = [];
    for (const [id, change] of edits) {
      const p = store.data.products.find((x) => x.id === id);
      const bad = Object.values(change).find((v) => Number.isNaN(parsePrice(v)));
      if (bad !== undefined) return toast(`${p.name}: “${bad}” isn’t a price.`, 'bad');
      const variants = [...(p.variants || [])].map((v) => (v.id in change ? { ...v, price: parsePrice(change[v.id]) } : v));
      // typing into an "n/a" cell adds that size to the fragrance
      for (const [col, value] of Object.entries(change)) {
        if (!variants.some((v) => v.id === col) && parsePrice(value) != null) {
          const c = cols.find((x) => x.id === col);
          variants.push(...normaliseSizes([{ type: c.type, ml: c.ml, price: parsePrice(value) }]));
        }
      }
      variants.sort((a, b) => order(a) - order(b));
      rows.push({ ...p, variants, price: fromPrice({ variants }) });
    }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const out = await api.products.saveMany(rows);
      const byId = new Map(out.map((r) => [r.id, r]));
      store.set('products', store.data.products.map((p) => byId.get(p.id) || p));
      edits.clear();
      markDirty();
      render();
      toast(`Prices saved for ${rows.length} fragrance${rows.length === 1 ? '' : 's'}. The site shows them now.`);
    } catch (err) {
      toast(err.message, 'bad');
      markDirty();
    } finally {
      btn.disabled = edits.size === 0;
    }
  });
  render();
}

export { CAT, TYPE_LABEL };
