-- 0019: the dev log — the founders' shared workbench.
-- Rudi posts updates and instructions ("flash this", "test that"),
-- Olof works through them and ticks them off; both see everything.
create table public.devlog (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  author uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  kind text not null default 'task' check (kind in ('update', 'task', 'note')),
  title text not null,
  body text,
  assignee text not null default 'Both' check (assignee in ('Rudi', 'Olof', 'Both')),
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz
);

create index devlog_open_idx on public.devlog (status, created_at desc);

alter table public.devlog enable row level security;
create policy "admins use the devlog" on public.devlog
  for all using (public.is_admin()) with check (public.is_admin());
