-- Olof's grow cabinet and biltong cabinet join the fleet.
insert into public.devices (serial, key_hash, role, mqtt_secret)
values
  ('FLX-0003', encode(extensions.digest('grow-cab-key-x7r2p9', 'sha256'), 'hex'), 'hub', 'flx3-grow-t8n3w'),
  ('FLX-0004', encode(extensions.digest('biltong-key-m4q8z2', 'sha256'), 'hex'), 'hub', 'flx4-bilt-h6v9s')
on conflict (serial) do nothing;

insert into public.claims (serial, claim_code)
values ('FLX-0003', 'GROW01'), ('FLX-0004', 'BILT01')
on conflict (serial) do nothing;
