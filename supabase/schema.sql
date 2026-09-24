-- ============================================================================
-- Raza Perfume · Supabase schema
-- Run once in Supabase → SQL Editor, then run seed.sql.
--
-- Security model
--   products     public can READ active rows; only the dashboard/staff edit them
--   orders       no public access at all
--   order_items  no public access at all
--   place_order  the ONLY way the website writes: it validates input and takes
--                prices from the products table, so a browser can't set prices
-- ============================================================================

-- ------------------------------------------------------------------ products
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  sheet_name  text,
  category    text not null check (category in ('regular', 'premium', 'luxury', 'house')),
  number      integer not null default 0,
  inspired    boolean not null default false,
  price       numeric(10, 2) check (price is null or price >= 0),   -- rupees; null = "Price on request"
  size_ml     integer check (size_ml is null or size_ml > 0),
  image_url   text,     -- optional real photo (e.g. Supabase Storage); otherwise the studio render
  description text,     -- optional; shown in the product quick view
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
-- for databases created before these columns existed
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists description text;
-- units in stock; null = not tracked, 0 = sold out (orders refused)
alter table public.products add column if not exists stock integer check (stock is null or stock >= 0);
-- sizes a product is sold in, each with its own price (from the spreadsheet), e.g.
--   [{"id": "perfume-30ml", "type": "perfume", "ml": 30, "price": 250, "label": "Perfume · 30 ml"}, …]
-- empty = sold in one size, priced by `price`. For products with sizes, `price` is the lowest ("from") price.
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb
  check (jsonb_typeof(variants) = 'array');

alter table public.products enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  to anon, authenticated
  using (active);

-- Supabase grants the public roles full table rights by default; keep reads only.
revoke insert, update, delete, truncate on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;

-- -------------------------------------------------------------------- orders
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigint generated always as identity (start with 1001) unique,
  customer_name   text not null,
  customer_phone  text not null,
  customer_city   text,
  note            text,
  subtotal        numeric(10, 2) not null default 0,   -- sum of priced items only
  has_unpriced    boolean not null default false,      -- true if any item is "price on request"
  status          text not null default 'new'
                  check (status in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  channel         text not null default 'whatsapp',
  created_at      timestamptz not null default now()
);

create table if not exists public.order_items (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    text not null references public.products (id),
  product_name  text not null,
  unit_price    numeric(10, 2),
  quantity      integer not null check (quantity between 1 and 99)
);
-- the size ordered, e.g. "Attar · 12 ml" (null for products sold in one size)
alter table public.order_items add column if not exists variant text;

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_phone_recent_idx on public.orders (customer_phone, created_at desc);

-- RLS on with no policies = the public key can neither read nor write these.
-- Table rights are revoked as well, so a mistaken policy later can't open them.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;

-- --------------------------------------------------------------- place_order
-- customer: {"name": "...", "phone": "...", "city": "...", "note": "..."}
-- items:    [{"id": "regular-dior-sauvage", "v": "attar-12ml", "qty": 2}, {"id": "luxury-madina", "qty": 1}, ...]
--           "v" = the size, for products sold in sizes
create or replace function public.place_order(customer jsonb, items jsonb)
returns table (order_id uuid, order_number bigint, subtotal numeric, has_unpriced boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_name   text := left(trim(coalesce(customer ->> 'name', '')), 80);
  v_phone  text := regexp_replace(coalesce(customer ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_city   text := nullif(left(trim(coalesce(customer ->> 'city', '')), 80), '');
  v_note   text := nullif(left(trim(coalesce(customer ->> 'note', '')), 500), '');
  v_order  public.orders%rowtype;
  v_lines  integer;
begin
  if length(v_name) < 2 then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15 then
    raise exception 'Please enter a valid phone number.' using errcode = '22023';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 60 then
    raise exception 'Your bag is empty.' using errcode = '22023';
  end if;

  -- flood protection: the public key can call this, so cap how fast orders arrive
  if (select count(*) from public.orders o
      where o.customer_phone = v_phone and o.created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'You have placed several orders just now. Please wait a few minutes, or message us on WhatsApp.' using errcode = '22023';
  end if;
  if (select count(*) from public.orders o where o.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'We are receiving many orders right now. Please try again in a minute.' using errcode = '22023';
  end if;

  insert into public.orders (customer_name, customer_phone, customer_city, note)
  values (v_name, v_phone, v_city, v_note)
  returning * into v_order;

  -- prices always come from the products table, never from the browser; a
  -- product sold in sizes is priced by the size chosen, and needs one
  insert into public.order_items (order_id, product_id, product_name, variant, unit_price, quantity)
  select v_order.id, p.id, p.name, s.label,
         case when s.id is not null then s.price else p.price end,
         least(greatest((i ->> 'qty')::int, 1), 99, coalesce(p.stock, 99))
  from jsonb_array_elements(items) as i
  join public.products p on p.id = i ->> 'id' and p.active and (p.stock is null or p.stock > 0)
  left join lateral (
    select x ->> 'id' as id, coalesce(x ->> 'label', x ->> 'id') as label, (x ->> 'price')::numeric as price
    from jsonb_array_elements(p.variants) as x
    where x ->> 'id' = i ->> 'v'
    limit 1
  ) s on true
  where jsonb_array_length(p.variants) = 0 or s.id is not null;

  get diagnostics v_lines = row_count;
  if v_lines = 0 then
    raise exception 'None of these fragrances are available.' using errcode = '22023';
  end if;

  update public.orders o
  set subtotal     = coalesce((select sum(oi.unit_price * oi.quantity) from public.order_items oi
                               where oi.order_id = o.id and oi.unit_price is not null), 0),
      has_unpriced = exists (select 1 from public.order_items oi
                             where oi.order_id = o.id and oi.unit_price is null)
  where o.id = v_order.id
  returning o.id, o.order_number, o.subtotal, o.has_unpriced
  into order_id, order_number, subtotal, has_unpriced;

  return next;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- --------------------------------------------------------------- newsletter
create table if not exists public.subscribers (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  created_at  timestamptz not null default now()
);
alter table public.subscribers enable row level security;
revoke all on public.subscribers from anon, authenticated;

create or replace function public.subscribe(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if (select count(*) from public.subscribers s where s.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Please try again in a minute.' using errcode = '22023';
  end if;
  insert into public.subscribers (email) values (v_email) on conflict (email) do nothing;
end;
$$;

revoke all on function public.subscribe(text) from public;
grant execute on function public.subscribe(text) to anon, authenticated;

-- ------------------------------------------------------ staff convenience
-- A readable order list for the Supabase dashboard (Table Editor → order_overview).
create or replace view public.order_overview
with (security_invoker = true) as
select
  o.order_number,
  o.created_at,
  o.status,
  o.customer_name,
  o.customer_phone,
  o.customer_city,
  o.subtotal,
  o.has_unpriced,
  string_agg(oi.product_name || coalesce(' (' || oi.variant || ')', '') || ' × ' || oi.quantity, ', ' order by oi.id) as items,
  o.note
from public.orders o
join public.order_items oi on oi.order_id = o.id
group by o.id
order by o.created_at desc;

revoke all on public.order_overview from anon, authenticated;
