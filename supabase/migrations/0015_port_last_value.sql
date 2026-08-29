-- 0015: remember each port's last value so ingest can spot state
-- changes (door, mains, outputs) and push "fans kicked in" style
-- notifications with real before/after knowledge.
alter table public.ports add column if not exists last_value double precision;
