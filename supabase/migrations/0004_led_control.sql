-- First control primitive: a server-held LED state the device applies
-- on its next report. The owner toggles it from the dashboard.
alter table public.devices
  add column if not exists led_on boolean not null default false;
