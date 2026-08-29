-- Public firmware bucket for cloud OTA + admin upload rights.
insert into storage.buckets (id, name, public)
values ('firmware', 'firmware', true)
on conflict (id) do nothing;

create policy "admins upload firmware" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'firmware' and public.is_admin());

create policy "admins update firmware" on storage.objects
  for update to authenticated
  using (bucket_id = 'firmware' and public.is_admin());

create policy "anyone reads firmware" on storage.objects
  for select using (bucket_id = 'firmware');
