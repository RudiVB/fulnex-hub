-- Device telemetry + instant-command channel secret.
alter table public.devices
  add column if not exists uptime_s    bigint,
  add column if not exists free_heap   int,
  add column if not exists boot_reason text,
  add column if not exists mqtt_secret text;

-- FLX-0002's command-topic secret (also lives in its config.h)
update public.devices
  set mqtt_secret = 'flx2-9k2m4vq7x'
  where serial = 'FLX-0002';
