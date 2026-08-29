-- ---------------------------------------------------------------
-- 0017: commerce — products, orders, subscriptions, revenue.
-- Admin-only tables (is_admin() RLS on everything). Devices learn
-- which product they are, so a minted biltong cabinet is labelled
-- and QR'd as a biltong cabinet, not a generic hub.
-- ---------------------------------------------------------------

alter table public.devices add column if not exists product text;

create table public.products (
  code text primary key,                 -- FLX-HUB-1, BILTONG-KAS, …
  name text not null,
  kind text not null check (kind in ('hub','cabinet','accessory','subscription')),
  price_cents int not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer text not null,
  email text,
  product_code text not null references public.products (code),
  device_serial text,                    -- filled once a unit is minted for it
  qty int not null default 1 check (qty > 0),
  price_cents int not null,              -- captured at sale time
  status text not null default 'quote'
    check (status in ('quote','paid','built','shipped','delivered','cancelled')),
  notes text
);

create table public.subscriptions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  customer text not null,
  email text,
  plan text not null default 'plus',
  amount_cents int not null default 4900,
  started_at date not null default current_date,
  status text not null check (status in ('active','cancelled')) default 'active'
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.subscriptions enable row level security;

create policy "admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage subscriptions" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- the catalogue as it stands today
insert into public.products (code, name, kind, price_cents) values
  ('FLX-HUB-1',     'Fulnex Hub',                   'hub',          149900),
  ('BILTONG-KAS',   'Biltong Cabinet',              'cabinet',      699500),
  ('BILTONG-KAS-F', 'Biltong Cabinet · Founder',    'cabinet',      549500),
  ('GROW-CAB',      'Grow Cabinet',                 'cabinet',     1299500),
  ('GROW-CAB-F',    'Grow Cabinet · Founder',       'cabinet',      999500),
  ('SENSE-TEMP',    'Temp probe (DS18B20)',         'accessory',     14900),
  ('SENSE-DOOR',    'Door contact',                 'accessory',      9900),
  ('PLUS-M',        'Fulnex Plus · monthly',        'subscription',   4900)
on conflict (code) do nothing;

-- the two live cabinets get their product identity
update public.devices set product = 'BILTONG-KAS' where serial = 'FLX-0004';
update public.devices set product = 'GROW-CAB'    where serial = 'FLX-0003';
update public.devices set product = 'FLX-HUB-1'   where serial in ('FLX-0001','FLX-0002');

-- provisioning learns products: mint a device AS a product
create or replace function public.provision_device(
  p_serial text default null,
  p_role text default 'hub',
  p_product text default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_serial text;
  v_key text;
  v_code text;
  v_mqtt text;
  v_id uuid;
  v_n int;
  v_pname text;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  if p_serial is null or trim(p_serial) = '' then
    select coalesce(max(substring(serial from 5)::int), 0) + 1 into v_n
      from public.devices where serial ~ '^FLX-[0-9]+$';
    v_serial := 'FLX-' || lpad(v_n::text, 4, '0');
  else
    v_serial := upper(trim(p_serial));
  end if;

  if p_product is not null then
    select name into v_pname from public.products where code = p_product;
    if v_pname is null then raise exception 'unknown product %', p_product; end if;
  end if;

  v_key  := encode(extensions.gen_random_bytes(12), 'hex');
  v_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  v_mqtt := 'flx-' || encode(extensions.gen_random_bytes(6), 'hex');

  insert into public.devices (serial, key_hash, role, mqtt_secret, product)
  values (v_serial,
          encode(extensions.digest(v_key, 'sha256'), 'hex'),
          coalesce(nullif(trim(p_role), ''), 'hub'),
          v_mqtt,
          p_product)
  returning id into v_id;

  insert into public.claims (serial, claim_code) values (v_serial, v_code);

  return json_build_object(
    'id', v_id,
    'serial', v_serial,
    'device_key', v_key,
    'claim_code', v_code,
    'mqtt_secret', v_mqtt,
    'product', p_product,
    'product_name', v_pname
  );
end $$;

revoke all on function public.provision_device(text, text, text) from public, anon;
grant execute on function public.provision_device(text, text, text) to authenticated;

-- the old two-arg signature is superseded
drop function if exists public.provision_device(text, text);
