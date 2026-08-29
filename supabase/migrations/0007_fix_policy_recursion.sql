-- devices' policy referenced device_members, whose policy referenced
-- devices — recursive RLS, which errors and made every device query
-- fail. Members-table policy now stands alone; owners manage members
-- through the security-definer RPC anyway.

drop policy "see own memberships or own device's members" on public.device_members;
create policy "see own memberships" on public.device_members
  for select using (user_id = auth.uid());

-- both founders are admins
update public.profiles set is_admin = true
where id in (
  '0cc22219-41e5-41f9-8ad1-991b9baf7b99',  -- rudivbuuren
  'ee85f7a8-3599-4e36-911d-25366bd2228e'   -- olofvb
);
