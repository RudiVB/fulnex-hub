-- Device sharing: an owner can share a device with other accounts by
-- email. Members see the device, its readings, and can use controls;
-- only the owner can share further.

create table public.device_members (
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (device_id, user_id)
);

alter table public.device_members enable row level security;

create policy "see own memberships or own device's members" on public.device_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.devices d
               where d.id = device_id and d.owner = auth.uid())
  );

-- helper used by every policy below; security definer so it can read
-- device_members without recursive RLS
create or replace function public.user_can_see_device(p_device_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.devices d
    where d.id = p_device_id
      and (d.owner = auth.uid()
           or exists (select 1 from public.device_members m
                      where m.device_id = d.id and m.user_id = auth.uid()))
  );
$$;

-- devices: owner or member reads and updates (rename, LED toggle)
drop policy "owner reads devices" on public.devices;
drop policy "owner renames devices" on public.devices;
create policy "member reads devices" on public.devices
  for select using (
    owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  );
create policy "member updates devices" on public.devices
  for update using (
    owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  ) with check (
    owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  );

-- dependent tables: swap owner checks for the helper
drop policy "owner reads ports" on public.ports;
drop policy "owner edits ports" on public.ports;
create policy "member reads ports" on public.ports
  for select using (public.user_can_see_device(device_id));
create policy "member edits ports" on public.ports
  for update using (public.user_can_see_device(device_id));

drop policy "owner reads readings" on public.readings;
create policy "member reads readings" on public.readings
  for select using (public.user_can_see_device(device_id));

drop policy "owner reads rollups" on public.readings_hourly;
create policy "member reads rollups" on public.readings_hourly
  for select using (public.user_can_see_device(device_id));

drop policy "owner manages rules" on public.alert_rules;
create policy "member manages rules" on public.alert_rules
  for all using (public.user_can_see_device(device_id))
  with check (public.user_can_see_device(device_id));

drop policy "owner reads events" on public.alert_events;
drop policy "owner acks events" on public.alert_events;
create policy "member reads events" on public.alert_events
  for select using (public.user_can_see_device(device_id));
create policy "member acks events" on public.alert_events
  for update using (public.user_can_see_device(device_id));

-- share by email — only the owner may share
create or replace function public.share_device(p_device_id uuid, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not signed in');
  end if;
  if not exists (select 1 from public.devices
                 where id = p_device_id and owner = auth.uid()) then
    return json_build_object('ok', false, 'error', 'only the owner can share');
  end if;

  select id into v_target from auth.users
    where lower(email) = lower(trim(p_email)) limit 1;
  if v_target is null then
    return json_build_object('ok', false, 'error', 'no account with that email');
  end if;
  if v_target = auth.uid() then
    return json_build_object('ok', false, 'error', 'that is you');
  end if;

  insert into public.device_members (device_id, user_id)
  values (p_device_id, v_target)
  on conflict do nothing;

  return json_build_object('ok', true);
end $$;
