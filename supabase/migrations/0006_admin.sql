-- Platform admin: sees and controls every device (fleet/support view).

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- the helper behind ports/readings/rollups/rules/events policies
create or replace function public.user_can_see_device(p_device_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.devices d
    where d.id = p_device_id
      and (d.owner = auth.uid()
           or exists (select 1 from public.device_members m
                      where m.device_id = d.id and m.user_id = auth.uid()))
  );
$$;

-- devices table policies gain the admin clause
drop policy "member reads devices" on public.devices;
drop policy "member updates devices" on public.devices;
create policy "member or admin reads devices" on public.devices
  for select using (
    public.is_admin()
    or owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  );
create policy "member or admin updates devices" on public.devices
  for update using (
    public.is_admin()
    or owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  ) with check (
    public.is_admin()
    or owner = auth.uid()
    or exists (select 1 from public.device_members m
               where m.device_id = id and m.user_id = auth.uid())
  );

-- the founder is the first admin: the account that claimed FLX-0001
update public.profiles set is_admin = true
where id = (select owner from public.devices where serial = 'FLX-0001');
