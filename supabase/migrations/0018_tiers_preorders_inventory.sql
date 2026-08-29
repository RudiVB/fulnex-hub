-- ---------------------------------------------------------------
-- 0018: tiers, public pre-orders, and build inventory.
--  - profiles.tier: free | plus | founder (both founders = founder)
--  - preorders: the public reservation queue — name, address, the
--    lot. Anyone may join; only admins (and the owner) may read.
--  - inventory: parts on hand vs parts-per-hub, so the admin page
--    can answer "how many hubs can we build today?"
--  - admins may read/update all profiles (settings tab needs it)
-- ---------------------------------------------------------------

alter table public.profiles
  add column if not exists tier text not null default 'free'
  check (tier in ('free', 'plus', 'founder'));

update public.profiles set tier = 'founder'
 where id in ('0cc22219-41e5-41f9-8ad1-991b9baf7b99',
              'ee85f7a8-3599-4e36-911d-25366bd2228e');

create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());
create policy "admins update all profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
create table public.preorders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  product_code text not null references public.products (code),
  qty int not null default 1 check (qty between 1 and 20),
  address text,
  city text,
  province text,
  postal_code text,
  notes text,
  status text not null default 'waiting'
    check (status in ('waiting', 'invited', 'converted', 'cancelled'))
);

alter table public.preorders enable row level security;

-- anyone may join the queue (pre-order phase; no payment collected)
create policy "anyone joins the queue" on public.preorders
  for insert to anon, authenticated with check (true);
create policy "own or admin reads preorders" on public.preorders
  for select using (public.is_admin() or user_id = auth.uid());
create policy "admin manages preorders" on public.preorders
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes preorders" on public.preorders
  for delete using (public.is_admin());

-- queue position: how many waiting reservations came before mine
create or replace function public.queue_position(p_id bigint)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.preorders
   where status = 'waiting' and id <= p_id;
$$;
grant execute on function public.queue_position(bigint) to anon, authenticated;

-- honest public counters for the pre-order page (no row access)
create or replace function public.public_stats()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'devices',      (select count(*) from public.devices where last_seen is not null),
    'online',       (select count(*) from public.devices
                      where last_seen > now() - interval '5 minutes'),
    'readings_24h', (select count(*) from public.readings
                      where ts > now() - interval '24 hours'),
    'queue',        (select count(*) from public.preorders where status = 'waiting')
  );
$$;
grant execute on function public.public_stats() to anon, authenticated;

-- ---------------------------------------------------------------
create table public.inventory (
  id bigint generated always as identity primary key,
  part text not null,
  on_hand int not null default 0,
  per_unit int not null default 1,       -- needed per FLX-HUB-1
  supplier text,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.inventory enable row level security;
create policy "admins manage inventory" on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.inventory (part, on_hand, per_unit, supplier) values
  ('ESP32 WROOM-32 module',        0, 1,  'Olof stock / Communica'),
  ('Carrier PCB Rev A',            0, 1,  'PCBWay'),
  ('3.5 mm stereo jack',           0, 12, 'Communica'),
  ('3.5 mm 4-pole jack',           0, 1,  'Communica'),
  ('SRD-05VDC relay',              0, 3,  'Communica'),
  ('Relay driver set (BJT+diode)', 0, 3,  'Communica'),
  ('USB-C power module',           0, 1,  'Communica'),
  ('3V3 buck converter',           0, 1,  'Communica'),
  ('Printed case (base + lid)',    0, 1,  'Rudi print farm'),
  ('Light pipe (clear filament)',  0, 1,  'Rudi print farm'),
  ('M2.5 screw set',               0, 8,  'Communica'),
  ('DS18B20 probe (incl. sense)',  0, 1,  'Communica'),
  ('Door contact (incl. sense)',   0, 1,  'Communica'),
  ('Box + quick-start card',       0, 1,  'local print');
