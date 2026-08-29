-- ---------------------------------------------------------------
-- 0014: push notifications — alerts reach the phone.
--
-- push_subscriptions: one row per browser/PWA install (Web Push).
-- profiles.notify_prefs: per-category switches the user controls
--   in the app: alerts / autopilot / door / offline.
-- notification_queue: everything to be delivered; the `notify`
--   edge function drains it (cron sweeps every minute via pg_net,
--   ingest pokes it instantly after enqueueing).
-- A trigger on alert_events enqueues rule breaches; the ingest
-- function enqueues autopilot/door state changes itself.
-- ---------------------------------------------------------------

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "own subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles
  add column if not exists notify_prefs jsonb not null
  default '{"alerts": true, "autopilot": true, "door": true, "offline": true}'::jsonb;

create table public.notification_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  category text not null default 'alerts',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_queue_unsent_idx
  on public.notification_queue (id) where sent_at is null;

-- service role only — no user policies at all
alter table public.notification_queue enable row level security;

-- everyone who should hear about a device: owner + shared members
create or replace function public.device_audience(p_device uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select owner from public.devices where id = p_device and owner is not null
  union
  select user_id from public.device_members where device_id = p_device;
$$;

revoke all on function public.device_audience(uuid) from public, anon, authenticated;

-- rule breaches -> queue (honouring each user's category switch)
create or replace function public.notify_alert_event()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  dname text;
  rtext text;
  cat text;
begin
  select coalesce(d.name, d.serial) into dname
    from public.devices d where d.id = new.device_id;

  select case when ar.condition = 'offline'
              then 'Offline — quiet for ' || ar.for_minutes || ' min'
              else coalesce(p.label, 'Port ' || ar.port_no) || ' ' ||
                   ar.condition || ' ' || ar.threshold ||
                   ' for ' || ar.for_minutes || ' min (now ' ||
                   round(new.value::numeric, 1) || ')'
         end,
         case when ar.condition = 'offline' then 'offline' else 'alerts' end
    into rtext, cat
    from public.alert_rules ar
    left join public.ports p
      on p.device_id = ar.device_id and p.port_no = ar.port_no
   where ar.id = new.rule_id;

  if rtext is null then return new; end if;

  for u in select public.device_audience(new.device_id) loop
    if coalesce((select (notify_prefs ->> cat)::boolean
                   from public.profiles where id = u), true) then
      insert into public.notification_queue (user_id, title, body, url, category)
      values (u, '⚠ ' || dname, rtext, '/device/' || new.device_id, cat);
    end if;
  end loop;
  return new;
end $$;

create trigger alert_event_notify
  after insert on public.alert_events
  for each row execute function public.notify_alert_event();

-- sweep the queue every minute (ingest also pokes notify directly,
-- so most notifications go out in seconds — this is the safety net)
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('drain-notifications', '* * * * *',
      $c$select net.http_post(
        url := 'https://esqtrcxaozymslwpeqgu.supabase.co/functions/v1/notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-notify-key', '6619677d7e0631a15d8542202e5214dd6ca42c23cf9a5d2d'),
        body := '{}'::jsonb
      )$c$);
  end if;
end $$;
