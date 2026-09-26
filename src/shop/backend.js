import { SHOP } from '../content.js';

// Supabase is optional: without keys the shop runs on the local catalogue and
// orders go straight to WhatsApp. The client library is loaded on demand so
// the story pages never pay for it up front.

let clientPromise = null;

export const backendEnabled = () => Boolean(SHOP.supabaseUrl && SHOP.supabaseKey);

function client() {
  if (!backendEnabled()) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SHOP.supabaseUrl, SHOP.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  );
  return clientPromise;
}

export async function fetchCatalog() {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb
    .from('products')
    .select('id, name, sheet_name, category, number, inspired, price, variants, stock, size_ml, image_url, description, images, featured')
    .order('category')
    .order('number');
  if (error) throw error;
  return data.map((r) => {
    const variants = Array.isArray(r.variants)
      ? r.variants.filter((v) => v?.id).map((v) => ({
        id: String(v.id),
        type: v.type ?? null,
        ml: Number(v.ml),
        price: v.price == null ? null : Number(v.price),
        label: v.label || String(v.id),
      }))
      : null;
    const sizePrices = (variants || []).map((v) => v.price).filter((n) => n != null);
    return {
      id: r.id,
      name: r.name,
      sheetName: r.sheet_name,
      category: r.category,
      number: r.number,
      inspired: r.inspired,
      // with sizes, the "from" price follows the size prices (staff may price sizes in the dashboard)
      price: sizePrices.length ? Math.min(...sizePrices) : r.price === null ? null : Number(r.price),
      variants,
      stock: r.stock === null || r.stock === undefined ? null : Number(r.stock),
      sizeMl: r.size_ml,
      image: r.image_url || null,
      description: r.description || null,
      // photos managed in the admin panel (none = keep the bundled photo / render)
      images: Array.isArray(r.images) && r.images.length
        ? r.images.filter((i) => i?.lg || i?.sm).map((i) => ({ lg: i.lg || i.sm, sm: i.sm || i.lg, alt: i.alt || r.name, kind: i.kind === 'card' ? 'card' : 'photo', url: true }))
        : null,
      featured: Boolean(r.featured),
    };
  });
}

// site copy edited in the admin panel: [{ key, value }]
export async function fetchContent() {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.from('site_content').select('key, value');
  if (error) throw error;
  return data;
}

// Blogs Raza films edited or added in the admin panel
export async function fetchFilms() {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.from('films').select('slug, title, text, category, product_id, featured, sort, active, video_url, poster_url, duration').order('sort');
  if (error) throw error;
  return data;
}

export class OrderError extends Error {
  constructor(message, { invalidInput = false } = {}) {
    super(message);
    this.invalidInput = invalidInput;
  }
}

export async function subscribe(email) {
  const sb = await client();
  if (!sb) throw new OrderError('Sign-ups are not open yet.');
  const { error } = await sb.rpc('subscribe', { p_email: email });
  if (error) throw new OrderError(error.code === '22023' ? error.message : 'Something went wrong. Please try again.');
}

// Saves the order through the place_order RPC (prices are set server-side).
// Returns null when no backend is configured.
export async function submitOrder(customer, items) {
  const sb = await client();
  if (!sb) return null;
  const { data, error } = await sb.rpc('place_order', { customer, items });
  if (error) {
    // 22023 = our own validation messages from place_order
    throw new OrderError(error.message, { invalidInput: error.code === '22023' });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { number: row.order_number, subtotal: Number(row.subtotal), hasUnpriced: row.has_unpriced };
}
