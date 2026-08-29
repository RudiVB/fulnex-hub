-- Dev/test device so the whole pipeline can be proven before hardware.
-- Serial FLX-0001, device key 'test-key-fulnex-0001', claim code KLAP01.
-- Delete this row set before production; real units use provision-device.sql.

insert into public.devices (serial, key_hash, role)
values ('FLX-0001', encode(extensions.digest('test-key-fulnex-0001', 'sha256'), 'hex'), 'hub')
on conflict (serial) do nothing;

insert into public.claims (serial, claim_code)
values ('FLX-0001', 'KLAP01')
on conflict (serial) do nothing;
