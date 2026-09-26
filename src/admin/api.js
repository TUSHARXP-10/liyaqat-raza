import { SHOP } from '../content.js';
import { PRODUCTS, SIGNATURES } from '../shop/products.js';

// The admin panel's data layer. Two back ends behind one interface:
//   supabase  the real thing: Supabase Auth + the tables in supabase/schema.sql
//             + the public "media" Storage bucket. Row-level security in the
//             database decides what an account may do.
//   demo      everything kept in this browser (localStorage), preloaded with
//             the site's catalogue — to try the panel before Supabase is set up.
//             It never touches the live site.

const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const TYPE_LABEL = { perfume: 'Perfume', attar: 'Attar' };
export { slug };

// sizes as the site stores them: id "perfume-30ml", label "Perfume · 30 ml"
export function normaliseSizes(sizes) {
  return sizes
    .filter((s) => Number(s.ml) > 0)
    .map((s) => {
      const type = s.type ? slug(s.type) : null;
      const ml = Number(s.ml);
      const price = s.price === '' || s.price == null || Number.isNaN(Number(s.price)) ? null : Math.max(0, Math.round(Number(s.price) * 100) / 100);
      const label = `${type ? `${TYPE_LABEL[type] || type[0].toUpperCase() + type.slice(1)} · ` : ''}${ml} ml`;
      return { id: `${type ? `${type}-` : ''}${ml}ml`, type, ml, price, label };
    });
}

// the site's bundled product → a database row
const bundledImages = (p) => (p.images || []).map((i) => ({ lg: `/${i.lg}`, sm: `/${i.sm}`, alt: i.alt, kind: i.kind || 'photo', ...(i.for ? { for: i.for } : {}) }));
function rowOf(p) {
  return {
    id: p.id, name: p.name, sheet_name: p.sheetName ?? null, category: p.category, number: p.number, inspired: p.inspired,
    price: p.price ?? null, variants: p.variants || [], stock: p.stock ?? null, description: p.description ?? null,
    images: bundledImages(p), featured: false, active: true, updated_at: new Date().toISOString(),
  };
}
const fromPrice = (row) => {
  if (!row.variants?.length) return row.price ?? null;
  const prices = row.variants.map((v) => v.price).filter((n) => n != null);
  return prices.length ? Math.min(...prices) : null;
};

/* ============================================================== supabase */

function supabaseApi() {
  let sbPromise = null;
  const sb = () => {
    sbPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SHOP.supabaseUrl, SHOP.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
    return sbPromise;
  };
  const must = ({ data, error }) => {
    if (error) throw new Error(friendly(error));
    return data;
  };
  const media = async () => (await sb()).storage.from('media');

  return {
    mode: 'supabase',
    auth: {
      async session() {
        return must(await (await sb()).auth.getSession()).session;
      },
      async signIn(email, password) {
        return must(await (await sb()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
      },
      async signOut() {
        await (await sb()).auth.signOut();
      },
      async resetPassword(email) {
        must(await (await sb()).auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${location.origin}/admin` }));
      },
      async setPassword(password) {
        must(await (await sb()).auth.updateUser({ password }));
      },
      async isAdmin() {
        return Boolean(must(await (await sb()).rpc('is_admin')));
      },
      async onChange(fn) {
        (await sb()).auth.onAuthStateChange((event, session) => fn(event, session));
      },
    },
    products: {
      async list() {
        return must(await (await sb()).from('products').select('*').order('category').order('number'));
      },
      async save(row) {
        const { updated_at, ...body } = row; // the database keeps prices in step with sizes
        return must(await (await sb()).from('products').upsert(body).select().single());
      },
      // many at once (the price list): one request
      async saveMany(rows) {
        const body = rows.map(({ updated_at, ...r }) => r);
        return must(await (await sb()).from('products').upsert(body).select());
      },
      async update(ids, patch) {
        must(await (await sb()).from('products').update(patch).in('id', ids));
      },
      async remove(id) {
        must(await (await sb()).from('products').delete().eq('id', id));
      },
    },
    content: {
      async list() {
        return must(await (await sb()).from('site_content').select('key, value, updated_at'));
      },
      async save(entries) {
        const rows = Object.entries(entries).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
        if (rows.length) must(await (await sb()).from('site_content').upsert(rows));
      },
      async reset(keys) {
        if (keys.length) must(await (await sb()).from('site_content').delete().in('key', keys));
      },
    },
    films: {
      async list() {
        return must(await (await sb()).from('films').select('*').order('sort'));
      },
      async save(row) {
        return must(await (await sb()).from('films').upsert(row).select().single());
      },
      async remove(slugValue) {
        must(await (await sb()).from('films').delete().eq('slug', slugValue));
      },
    },
    orders: {
      async list() {
        return must(await (await sb()).from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(500));
      },
      async update(id, patch) {
        must(await (await sb()).from('orders').update(patch).eq('id', id));
      },
    },
    subscribers: {
      async list() {
        return must(await (await sb()).from('subscribers').select('*').order('created_at', { ascending: false }));
      },
      async remove(id) {
        must(await (await sb()).from('subscribers').delete().eq('id', id));
      },
    },
    admins: {
      async list() {
        return must(await (await sb()).from('admins').select('*').order('added_at'));
      },
      async add(email) {
        must(await (await sb()).from('admins').insert({ email: email.trim().toLowerCase() }));
      },
      async remove(email) {
        must(await (await sb()).from('admins').delete().eq('email', email));
      },
    },
    media: {
      async upload(path, blob, contentType) {
        const bucket = await media();
        must(await bucket.upload(path, blob, { contentType, cacheControl: '31536000', upsert: true }));
        return bucket.getPublicUrl(path).data.publicUrl;
      },
      async list(prefix = '') {
        const bucket = await media();
        const items = must(await bucket.list(prefix, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } }));
        return items.map((i) => ({
          name: i.name, path: prefix ? `${prefix}/${i.name}` : i.name, folder: !i.id,
          size: i.metadata?.size || 0, type: i.metadata?.mimetype || '', created: i.created_at,
          url: i.id ? bucket.getPublicUrl(prefix ? `${prefix}/${i.name}` : i.name).data.publicUrl : null,
        }));
      },
      async remove(paths) {
        must(await (await media()).remove(paths));
      },
    },
  };
}

// database errors in plain words
function friendly(error) {
  const m = error.message || String(error);
  if (/Invalid login credentials/i.test(m)) return 'That email and password don’t match an account.';
  if (/Email not confirmed/i.test(m)) return 'This email hasn’t been confirmed yet. Check the inbox for the confirmation link.';
  if (/row-level security|permission denied/i.test(m)) return 'This account isn’t allowed to change that. Only admins can edit the site.';
  if (/foreign key/i.test(m) && /order_items/i.test(m)) return 'This fragrance appears in past orders, so it can’t be deleted. Hide it instead.';
  if (/duplicate key/i.test(m)) return 'That already exists.';
  if (/Payload too large|exceeded the maximum/i.test(m)) return 'That file is too large (50 MB at most).';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No connection. Check the internet and try again.';
  return m;
}

/* ================================================================== demo */

function demoApi() {
  const KEY = 'raza-admin-demo-v1';
  const blobs = new Map(); // uploads live for this tab only
  const seed = () => {
    const products = [...PRODUCTS, ...SIGNATURES].map(rowOf);
    const now = Date.now();
    const order = (n, mins, name, phone, city, status, items) => ({
      id: `demo-${n}`, order_number: n, customer_name: name, customer_phone: phone, customer_city: city, note: null,
      status, channel: 'whatsapp', created_at: new Date(now - mins * 60000).toISOString(),
      order_items: items.map(([id, v, qty], i) => {
        const p = products.find((x) => x.id === id);
        const size = p.variants.find((x) => x.id === v);
        return { id: n * 10 + i, product_id: id, product_name: p.name, variant: size?.label ?? null, unit_price: size ? size.price : p.price, quantity: qty };
      }),
    });
    const orders = [
      order(1004, 12, 'Ayesha Khan', '+919876543210', 'Kalyan', 'new', [['regular-cool-water', 'attar-12ml', 2], ['regular-dior-sauvage', 'perfume-50ml', 1]]),
      order(1003, 190, 'Rohan Mehta', '+919820011223', 'Thane', 'confirmed', [['luxury-rasasi-hawas', 'attar-6ml', 1]]),
      order(1002, 1500, 'Sana Shaikh', '+919930044556', 'Mumbai', 'shipped', [['regular-invictus', 'perfume-100ml', 1], ['regular-cr7', 'perfume-30ml', 2]]),
      order(1001, 4300, 'Imran Qureshi', '+919867788990', 'Bhiwandi', 'delivered', [['regular-creed-aventus', 'perfume-50ml', 1]]),
    ].map((o) => ({ ...o, subtotal: o.order_items.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity, 0), has_unpriced: o.order_items.some((i) => i.unit_price == null) }));
    return {
      products, content: {}, films: [], orders,
      subscribers: [
        { id: 3, email: 'zara.m@example.com', created_at: new Date(now - 3600e3).toISOString() },
        { id: 2, email: 'farhan.s@example.com', created_at: new Date(now - 86400e3 * 2).toISOString() },
        { id: 1, email: 'neha.k@example.com', created_at: new Date(now - 86400e3 * 6).toISOString() },
      ],
      admins: [{ email: 'demo@razaperfume.com', added_at: new Date(now - 86400e3 * 30).toISOString() }],
      signedIn: false,
    };
  };
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY)) || seed();
  } catch {
    db = seed();
  }
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch { /* storage full: keep going for this visit */ }
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const wait = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 120));
  const listeners = [];

  return {
    mode: 'demo',
    reset() {
      db = seed();
      persist();
    },
    auth: {
      async session() {
        return db.signedIn ? { user: { email: db.signedIn } } : null;
      },
      async signIn(email, password) {
        if (!email.includes('@') || password.length < 4) throw new Error('Enter an email and a password (any, in the demo).');
        db.signedIn = email.trim().toLowerCase();
        persist();
        listeners.forEach((fn) => fn('SIGNED_IN', { user: { email: db.signedIn } }));
        return { user: { email: db.signedIn } };
      },
      async signOut() {
        db.signedIn = false;
        persist();
        listeners.forEach((fn) => fn('SIGNED_OUT', null));
      },
      async resetPassword() {},
      async setPassword() {},
      async isAdmin() {
        return true;
      },
      async onChange(fn) {
        listeners.push(fn);
      },
    },
    products: {
      list: () => wait(db.products),
      async save(row) {
        const next = { ...row, price: fromPrice(row), updated_at: new Date().toISOString() };
        const i = db.products.findIndex((p) => p.id === row.id);
        if (i >= 0) db.products[i] = next;
        else db.products.push(next);
        persist();
        return wait(next);
      },
      async saveMany(rows) {
        const out = [];
        for (const row of rows) {
          const next = { ...row, price: fromPrice(row), updated_at: new Date().toISOString() };
          const i = db.products.findIndex((p) => p.id === row.id);
          if (i >= 0) db.products[i] = next;
          else db.products.push(next);
          out.push(next);
        }
        persist();
        return wait(out);
      },
      async update(ids, patch) {
        db.products = db.products.map((p) => (ids.includes(p.id) ? { ...p, ...patch, updated_at: new Date().toISOString() } : p));
        persist();
      },
      async remove(id) {
        if (db.orders.some((o) => o.order_items.some((i) => i.product_id === id))) throw new Error('This fragrance appears in past orders, so it can’t be deleted. Hide it instead.');
        db.products = db.products.filter((p) => p.id !== id);
        persist();
      },
    },
    content: {
      list: () => wait(Object.entries(db.content).map(([key, v]) => ({ key, value: v.value, updated_at: v.at }))),
      async save(entries) {
        for (const [key, value] of Object.entries(entries)) db.content[key] = { value, at: new Date().toISOString() };
        persist();
      },
      async reset(keys) {
        keys.forEach((k) => delete db.content[k]);
        persist();
      },
    },
    films: {
      list: () => wait(db.films),
      async save(row) {
        const i = db.films.findIndex((f) => f.slug === row.slug);
        if (i >= 0) db.films[i] = { ...db.films[i], ...row };
        else db.films.push({ created_at: new Date().toISOString(), ...row });
        persist();
        return wait(row);
      },
      async remove(s) {
        db.films = db.films.filter((f) => f.slug !== s);
        persist();
      },
    },
    orders: {
      list: () => wait(db.orders),
      async update(id, patch) {
        db.orders = db.orders.map((o) => (o.id === id ? { ...o, ...patch } : o));
        persist();
      },
    },
    subscribers: {
      list: () => wait(db.subscribers),
      async remove(id) {
        db.subscribers = db.subscribers.filter((s) => s.id !== id);
        persist();
      },
    },
    admins: {
      list: () => wait(db.admins),
      async add(email) {
        const e = email.trim().toLowerCase();
        if (db.admins.some((a) => a.email === e)) throw new Error('That already exists.');
        db.admins.push({ email: e, added_at: new Date().toISOString() });
        persist();
      },
      async remove(email) {
        db.admins = db.admins.filter((a) => a.email !== email);
        persist();
      },
    },
    media: {
      async upload(path, blob, contentType) {
        const url = URL.createObjectURL(blob);
        blobs.set(path, { url, size: blob.size, type: contentType, created: new Date().toISOString() });
        return url;
      },
      async list(prefix = '') {
        const out = [];
        const folders = new Set();
        for (const [path, b] of blobs) {
          if (prefix && !path.startsWith(`${prefix}/`)) continue;
          const rest = prefix ? path.slice(prefix.length + 1) : path;
          if (rest.includes('/')) folders.add(rest.split('/')[0]);
          else out.push({ name: rest, path, folder: false, size: b.size, type: b.type, created: b.created, url: b.url });
        }
        return [...[...folders].map((f) => ({ name: f, path: prefix ? `${prefix}/${f}` : f, folder: true })), ...out];
      },
      async remove(paths) {
        paths.forEach((p) => blobs.delete(p));
      },
    },
  };
}

/* ------------------------------------------------------------------ pick */

export const configured = () => Boolean(SHOP.supabaseUrl && SHOP.supabaseKey);
export const wantsDemo = () => new URLSearchParams(location.search).has('demo') || !configured();
export const api = wantsDemo() ? demoApi() : supabaseApi();
export { fromPrice };
