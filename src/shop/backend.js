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
    .select('id, name, sheet_name, category, number, inspired, price, size_ml, image_url, description')
    .order('category')
    .order('number');
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    sheetName: r.sheet_name,
    category: r.category,
    number: r.number,
    inspired: r.inspired,
    price: r.price === null ? null : Number(r.price),
    sizeMl: r.size_ml,
    image: r.image_url || null,
    description: r.description || null,
  }));
}

export class OrderError extends Error {
  constructor(message, { invalidInput = false } = {}) {
    super(message);
    this.invalidInput = invalidInput;
  }
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
