-- Provision one new device at flash time.
-- Run in the Supabase SQL editor. Change the three values, run,
-- then flash the SERIAL + KEY into the firmware and print
-- SERIAL + CLAIM CODE on the unit's label.
--
-- The key below is stored hashed; the plain key lives only in the
-- device's flash and on your flashing sheet.

with vals as (
  select
    'FLX-0001'  as serial,      -- unit serial, printed on label
    'change-me-device-key-0001' as device_key,  -- long random string, goes in firmware
    'KLAP01'    as claim_code   -- short code, printed on label
)
, dev as (
  insert into public.devices (serial, key_hash, role)
  select serial, encode(extensions.digest(device_key, 'sha256'), 'hex'), 'hub' from vals
  returning serial
)
insert into public.claims (serial, claim_code)
select dev.serial, vals.claim_code from dev, vals;

-- Requires the pgcrypto extension for digest():
--   create extension if not exists pgcrypto;
