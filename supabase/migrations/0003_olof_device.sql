-- Olof's first device — flashed with firmware/fulnex_hub (FLX-0002).
-- He claims it on the site with the code below.

insert into public.devices (serial, key_hash, role)
values ('FLX-0002', encode(extensions.digest('olof-first-device-key-8c31', 'sha256'), 'hex'), 'hub')
on conflict (serial) do nothing;

insert into public.claims (serial, claim_code)
values ('FLX-0002', 'OLOF01')
on conflict (serial) do nothing;
