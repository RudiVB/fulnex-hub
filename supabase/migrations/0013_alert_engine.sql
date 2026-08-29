-- ---------------------------------------------------------------
-- 0013: the alert engine — rules stop being decoration.
--
-- Every minute a cron job evaluates enabled rules against the
-- last readings. A breach that holds for the rule's window raises
-- an alert_event; when the value comes back in range (or the
-- device comes back online) the event resolves itself.
--
-- New rule condition 'offline': fires when the device has not
-- reported for `for_minutes` minutes. port_no/threshold ignored.
-- ---------------------------------------------------------------

alter table public.alert_events
  add column if not exists resolved_at timestamptz;

create index if not exists alert_events_open_idx
  on public.alert_events (rule_id) where resolved_at is null;
create index if not exists alert_events_device_idx
  on public.alert_events (device_id, started_at desc);

alter table public.alert_rules drop constraint if exists alert_rules_condition_check;
alter table public.alert_rules
  add constraint alert_rules_condition_check
  check (condition in ('above', 'below', 'offline'));

create or replace function public.evaluate_alert_rules()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  breach boolean;
  back_ok boolean;
  latest double precision;
  n_all bigint;
  n_ok bigint;
  first_ts timestamptz;
  open_id bigint;
  ev_value double precision;
begin
  for r in
    select ar.id, ar.device_id, ar.port_no, ar.condition, ar.threshold,
           greatest(ar.for_minutes, 1) as for_minutes, d.last_seen
    from public.alert_rules ar
    join public.devices d on d.id = ar.device_id
    where ar.enabled
  loop
    breach := false;
    back_ok := false;
    ev_value := 0;

    if r.condition = 'offline' then
      breach := r.last_seen is null
                or r.last_seen < now() - make_interval(mins => r.for_minutes);
      back_ok := not breach and r.last_seen is not null;
      ev_value := coalesce(extract(epoch from (now() - r.last_seen)) / 60.0, 0);
    else
      -- window stats: n_ok counts readings that DON'T breach
      select count(*),
             count(*) filter (where (r.condition = 'above' and value <= r.threshold)
                                 or (r.condition = 'below' and value >= r.threshold)),
             min(ts)
        into n_all, n_ok, first_ts
        from public.readings
       where device_id = r.device_id
         and port_no = r.port_no
         and ts >= now() - make_interval(mins => r.for_minutes);

      select value into latest
        from public.readings
       where device_id = r.device_id and port_no = r.port_no
         and ts >= now() - make_interval(mins => r.for_minutes)
       order by ts desc limit 1;

      -- breach = every reading in the window is past the threshold AND
      -- the window is actually covered (oldest sample near its start)
      breach := n_all > 0 and n_ok = 0
                and first_ts <= now() - make_interval(mins => r.for_minutes)
                                + interval '90 seconds';
      -- resolve only on real evidence: a fresh reading back in range
      -- (no data = device silent = leave the event standing)
      back_ok := latest is not null
                 and ((r.condition = 'above' and latest <= r.threshold)
                   or (r.condition = 'below' and latest >= r.threshold));
      ev_value := coalesce(latest, r.threshold);
    end if;

    select id into open_id
      from public.alert_events
     where rule_id = r.id and resolved_at is null
     order by started_at desc limit 1;

    if breach and open_id is null then
      insert into public.alert_events (rule_id, device_id, value)
      values (r.id, r.device_id, ev_value);
    elsif back_ok and open_id is not null then
      update public.alert_events set resolved_at = now() where id = open_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.evaluate_alert_rules() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('evaluate-alerts', '* * * * *',
                          'select public.evaluate_alert_rules()');
  end if;
end $$;
