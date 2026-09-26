import { api } from '../api.js';
import { $, esc, icon, toast, drawer, confirmBox, rupees, ago, when } from '../ui.js';

// Orders (placed from the bag, confirmed on WhatsApp) and newsletter subscribers.

export const STATUSES = [
  { key: 'new', label: 'New', badge: 'info' },
  { key: 'confirmed', label: 'Confirmed', badge: 'gold' },
  { key: 'shipped', label: 'Shipped', badge: 'warn' },
  { key: 'delivered', label: 'Delivered', badge: 'ok' },
  { key: 'cancelled', label: 'Cancelled', badge: 'bad' },
];
const S = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
export const statusBadge = (k) => `<span class="badge badge--${S[k]?.badge || 'plain'}">${esc(S[k]?.label || k)}</span>`;
export const orderTotal = (o) => (!Number(o.subtotal) && o.has_unpriced ? 'On request' : `${rupees(Number(o.subtotal) || 0)}${o.has_unpriced ? ' + on request' : ''}`);
const itemsLine = (o) => (o.order_items || []).map((i) => `${i.product_name}${i.variant ? ` (${i.variant})` : ''} × ${i.quantity}`).join(', ');
const waLink = (o, text) => `https://wa.me/${String(o.customer_phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

const state = { status: 'new', q: '' };

export async function orders({ page, store, setTitle }) {
  const all = await store.get('orders', true);
  if (!all.some((o) => o.status === state.status) && state.status !== 'all') state.status = all.some((o) => o.status === 'new') ? 'new' : 'all';
  setTitle('Orders', 'Placed from the bag on the site, then confirmed with the customer on WhatsApp.', `<button class="btn" type="button" data-reload>${icon('download')}Refresh</button>`);

  page.innerHTML = `
    <div class="toolbar">
      <div class="tabs" data-tabs></div>
      <label class="search">${icon('search')}<span class="sr-only">Search</span><input class="input" type="search" placeholder="Name, phone or order number" value="${esc(state.q)}" data-q /></label>
    </div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th class="hide-sm">Items</th><th>Total</th><th>Status</th><th class="hide-sm">Placed</th></tr></thead>
      <tbody data-rows></tbody>
    </table></div></div>`;

  const render = () => {
    const list = store.data.orders;
    $('[data-tabs]', page).innerHTML = [...STATUSES, { key: 'all', label: 'All' }].map((s) => {
      const n = s.key === 'all' ? list.length : list.filter((o) => o.status === s.key).length;
      return `<button type="button" class="tab${state.status === s.key ? ' is-on' : ''}" data-status="${s.key}">${s.label}<small>${n}</small></button>`;
    }).join('');
    const q = state.q.trim().toLowerCase();
    const shown = list.filter((o) => (state.status === 'all' || o.status === state.status)
      && (!q || `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.customer_city || ''}`.toLowerCase().includes(q)));
    $('[data-rows]', page).innerHTML = shown.length ? shown.map((o) => `
      <tr data-id="${esc(o.id)}" style="cursor:pointer">
        <td><b class="num">#${o.order_number}</b></td>
        <td><b>${esc(o.customer_name)}</b><br /><small class="dim">${esc(o.customer_phone)}${o.customer_city ? ` · ${esc(o.customer_city)}` : ''}</small></td>
        <td class="hide-sm" style="max-width:340px"><span class="muted">${esc(itemsLine(o))}</span></td>
        <td class="num">${orderTotal(o)}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="hide-sm dim">${ago(o.created_at)}</td>
      </tr>`).join('') : `<tr><td colspan="6"><div class="empty"><b>No ${state.status === 'all' ? '' : `${S[state.status]?.label.toLowerCase()} `}orders</b>${list.length ? 'Try another tab.' : 'Orders placed from the bag on the site appear here.'}</div></td></tr>`;
  };

  const open = (o) => {
    const lines = (o.order_items || []).map((i) => `<tr><td>${esc(i.product_name)}${i.variant ? `<br /><small class="dim">${esc(i.variant)}</small>` : ''}</td><td class="num">× ${i.quantity}</td><td class="num">${i.unit_price != null ? rupees(i.unit_price * i.quantity) : '<span class="badge badge--warn badge--plain">On request</span>'}</td></tr>`).join('');
    const d = drawer({
      title: `Order #${o.order_number}`,
      body: `
        <div class="stack">
          <div class="row">${statusBadge(o.status)}<span class="dim">${when(o.created_at)}</span></div>
          <dl class="kv"><dt>Customer</dt><dd>${esc(o.customer_name)}</dd><dt>Phone</dt><dd>${esc(o.customer_phone)}</dd>${o.customer_city ? `<dt>City</dt><dd>${esc(o.customer_city)}</dd>` : ''}${o.note ? `<dt>Note</dt><dd>${esc(o.note)}</dd>` : ''}</dl>
          <div class="row">
            <a class="btn btn--gold" target="_blank" rel="noopener" href="${esc(waLink(o, `Hello ${o.customer_name}, thank you for your Raza Perfume order #${o.order_number}. `))}">${icon('whatsapp')}WhatsApp</a>
            <a class="btn" href="tel:${esc(o.customer_phone)}">${icon('phone')}Call</a>
          </div>
          <table class="order-lines">${lines}<tr><td><b>Total</b></td><td></td><td class="num"><b>${orderTotal(o)}</b></td></tr></table>
          <div><p class="label" style="margin-bottom:8px">Move to</p><div class="row">${STATUSES.filter((s) => s.key !== o.status).map((s) => `<button class="btn btn--sm${s.key === 'cancelled' ? ' btn--danger' : ''}" type="button" data-to="${s.key}">${s.label}</button>`).join('')}</div></div>
        </div>`,
    });
    d.el.addEventListener('click', async (e) => {
      const to = e.target.closest('[data-to]')?.dataset.to;
      if (!to) return;
      if (to === 'cancelled' && !(await confirmBox({ title: `Cancel order #${o.order_number}?`, text: 'You can move it back later if needed.', ok: 'Cancel order', danger: true }))) return;
      try {
        await api.orders.update(o.id, { status: to });
        store.set('orders', store.data.orders.map((x) => (x.id === o.id ? { ...x, status: to } : x)));
        toast(`Order #${o.order_number} → ${S[to].label}.`);
        d.close();
        render();
      } catch (err) {
        toast(err.message, 'bad');
      }
    });
  };

  page.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-status]');
    if (tab) {
      state.status = tab.dataset.status;
      return render();
    }
    const row = e.target.closest('tr[data-id]');
    if (row) open(store.data.orders.find((o) => o.id === row.dataset.id));
  });
  page.addEventListener('input', (e) => {
    if (e.target.matches('[data-q]')) {
      state.q = e.target.value;
      render();
    }
  });
  $('[data-reload]').addEventListener('click', async () => {
    await store.get('orders', true);
    render();
    toast('Orders refreshed.', 'info');
  });
  render();
}

export async function subscribers({ page, store, setTitle }) {
  const list = await store.get('subscribers', true);
  setTitle('Subscribers', `${list.length} ${list.length === 1 ? 'person' : 'people'} joined the newsletter from the site footer.`, `<button class="btn" type="button" data-csv${list.length ? '' : ' disabled'}>${icon('download')}Download CSV</button>`);
  const render = () => {
    page.innerHTML = store.data.subscribers.length ? `<div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
      <tbody>${store.data.subscribers.map((s) => `<tr data-id="${s.id}"><td><a class="linkish" href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td class="dim">${when(s.created_at)}</td><td style="text-align:right"><button class="icon-btn" type="button" data-remove aria-label="Remove ${esc(s.email)}">${icon('trash')}</button></td></tr>`).join('')}</tbody>
    </table></div></div>` : '<div class="empty"><b>No subscribers yet</b>People who join from the site footer appear here.</div>';
  };
  page.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const id = Number(btn.closest('[data-id]').dataset.id);
    const s = store.data.subscribers.find((x) => x.id === id);
    if (!(await confirmBox({ title: `Remove ${s.email}?`, text: 'They won’t get newsletters any more.', ok: 'Remove', danger: true }))) return;
    try {
      await api.subscribers.remove(id);
      store.set('subscribers', store.data.subscribers.filter((x) => x.id !== id));
      render();
      toast(`${s.email} removed.`);
    } catch (err) {
      toast(err.message, 'bad');
    }
  });
  $('[data-csv]')?.addEventListener('click', () => {
    const csv = ['email,joined', ...store.data.subscribers.map((s) => `${s.email},${s.created_at}`)].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `raza-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });
  render();
}
