-- Fulnex Hub platform — initial schema
-- Designed for many users and millions of readings:
-- readings are month-partitioned, raw kept ~90 days, hourly rollups kept forever.

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,          -- e.g. FLX-7F3A21
  key_hash text not null,               -- sha256 hex of the device key
  owner uuid references auth.users (id) on delete set null,
  name text,
  role text not null default 'hub',     -- hub | geyser | sense
  fw_version text,
  last_seen timestamptz,
  wifi_rssi int,
  battery_pct int,
  created_at timestamptz not null default now()
);

create index devices_owner_idx on public.devices (owner);

alter table public.devices enable row level security;

create policy "owner reads devices" on public.devices
  for select using (owner = auth.uid());
create policy "owner renames devices" on public.devices
  for update using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------
-- claims — minted at flash time; consumed once by claim_device()
-- ---------------------------------------------------------------
create table public.claims (
  serial text primary key references public.devices (serial) on delete cascade,
  claim_code text not null,             -- short code printed on the unit label
  claimed_at timestamptz
);

alter table public.claims enable row level security;
-- no user-facing policies: claiming goes through the RPC below.

create or replace function public.claim_device(p_serial text, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_claim public.claims%rowtype;
  v_device_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not signed in');
  end if;

  select * into v_claim from public.claims
    where serial = upper(trim(p_serial));
  if not found then
    return json_build_object('ok', false, 'error', 'unknown serial');
  end if;
  if v_claim.claimed_at is not null then
    return json_build_object('ok', false, 'error', 'already claimed');
  end if;
  if v_claim.claim_code <> upper(trim(p_code)) then
    return json_build_object('ok', false, 'error', 'wrong claim code');
  end if;

  update public.devices set owner = auth.uid()
    where serial = v_claim.serial
    returning id into v_device_id;
  update public.claims set claimed_at = now()
    where serial = v_claim.serial;

  return json_build_object('ok', true, 'device_id', v_device_id);
end $$;

-- ---------------------------------------------------------------
-- ports — one row per jack / sense channel on a device
-- ---------------------------------------------------------------
create table public.ports (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  port_no smallint not null,            -- 1..6 jacks; 100+ for BLE senses
  kind text,                            -- temp | humidity | contact | leak | motion | level | analog
  label text,
  unique (device_id, port_no)
);

alter table public.ports enable row level security;

create policy "owner reads ports" on public.ports
  for select using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));
create policy "owner edits ports" on public.ports
  for update using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));

-- ---------------------------------------------------------------
-- readings — the big one. Month-partitioned; writes only via the
-- ingest edge function (service role), never from clients.
-- ---------------------------------------------------------------
create table public.readings (
  device_id uuid not null,
  port_no smallint not null,
  ts timestamptz not null,
  value double precision not null,
  primary key (device_id, port_no, ts)
) partition by range (ts);

create index readings_ts_brin on public.readings using brin (ts);
create index readings_device_ts on public.readings (device_id, ts desc);

alter table public.readings enable row level security;

create policy "owner reads readings" on public.readings
  for select using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));

-- partition helper: ensures the partition for a given month exists
create or replace function public.ensure_readings_partition(p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  text := 'readings_' || to_char(v_start, 'YYYY_MM');
begin
  if not exists (select 1 from pg_class where relname = v_name) then
    execute format(
      'create table public.%I partition of public.readings for values from (%L) to (%L)',
      v_name, v_start, v_end);
  end if;
end $$;

select public.ensure_readings_partition(current_date);
select public.ensure_readings_partition((current_date + interval '1 month')::date);

-- drop raw partitions older than ~3 months (rollups keep the history)
create or replace function public.drop_old_readings_partitions()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select relname from pg_class
    where relname like 'readings\_20%' escape '\'
      and relkind = 'r'
      and to_date(substring(relname from 'readings_(\d{4}_\d{2})'), 'YYYY_MM')
          < date_trunc('month', now()) - interval '3 months'
  loop
    execute format('drop table public.%I', r.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- readings_hourly — rollups, kept forever
-- ---------------------------------------------------------------
create table public.readings_hourly (
  device_id uuid not null,
  port_no smallint not null,
  hour timestamptz not null,
  v_min double precision not null,
  v_avg double precision not null,
  v_max double precision not null,
  samples int not null,
  primary key (device_id, port_no, hour)
);

alter table public.readings_hourly enable row level security;

create policy "owner reads rollups" on public.readings_hourly
  for select using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));

create or replace function public.rollup_readings_hourly()
returns void language sql security definer set search_path = public as $$
  insert into public.readings_hourly
    (device_id, port_no, hour, v_min, v_avg, v_max, samples)
  select device_id, port_no, date_trunc('hour', ts),
         min(value), avg(value), max(value), count(*)
  from public.readings
  where ts >= date_trunc('hour', now()) - interval '2 hours'
    and ts <  date_trunc('hour', now())
  group by device_id, port_no, date_trunc('hour', ts)
  on conflict (device_id, port_no, hour) do update
    set v_min = excluded.v_min, v_avg = excluded.v_avg,
        v_max = excluded.v_max, samples = excluded.samples;
$$;

-- ---------------------------------------------------------------
-- alerts — one simple rule type, done well
-- ---------------------------------------------------------------
create table public.alert_rules (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices (id) on delete cascade,
  port_no smallint not null,
  condition text not null check (condition in ('above', 'below')),
  threshold double precision not null,
  for_minutes int not null default 5,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alert_rules enable row level security;

create policy "owner manages rules" on public.alert_rules
  for all using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()))
  with check (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));

create table public.alert_events (
  id bigint generated always as identity primary key,
  rule_id bigint not null references public.alert_rules (id) on delete cascade,
  device_id uuid not null,
  started_at timestamptz not null default now(),
  value double precision not null,
  acknowledged_at timestamptz
);

alter table public.alert_events enable row level security;

create policy "owner reads events" on public.alert_events
  for select using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));
create policy "owner acks events" on public.alert_events
  for update using (exists (select 1 from public.devices d
    where d.id = device_id and d.owner = auth.uid()));

-- ---------------------------------------------------------------
-- pg_cron housekeeping (enable the pg_cron extension in the
-- dashboard first; then these schedules apply cleanly)
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('rollup-hourly',      '5 * * * *',  'select public.rollup_readings_hourly()');
    perform cron.schedule('ensure-partition',   '0 0 25 * *', $c$select public.ensure_readings_partition((current_date + interval '1 month')::date)$c$);
    perform cron.schedule('drop-old-partitions','0 1 1 * *',  'select public.drop_old_readings_partitions()');
  end if;
end $$;
