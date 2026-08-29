-- Extensions the platform needs.
create extension if not exists pgcrypto;

-- pg_cron powers the hourly rollups and partition housekeeping.
-- Guarded so the push still succeeds if the instance disallows it;
-- in that case enable it in Dashboard -> Database -> Extensions
-- and re-run the cron block at the end of 0001_init.sql.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not enabled here: %', sqlerrm;
end $$;
