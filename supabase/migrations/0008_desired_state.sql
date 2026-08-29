-- Generic control channel: what the owner wants the device to be.
-- Flat JSON keys; the ingest reply carries them and firmware acts on
-- the ones it understands. led_on stays for the original toggle.
alter table public.devices
  add column if not exists desired jsonb not null default '{}';
