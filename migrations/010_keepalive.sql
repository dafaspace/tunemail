-- A table whose only job is to be written to.
--
-- The keep-alive cron has been firing correctly and Supabase warned about
-- inactivity anyway. Measured in Cloudflare's logs, 7-day window:
--
--   2026-08-27 06:00  scheduled  success
--   2026-08-29 06:00  scheduled  success
--   2026-08-31 06:00  scheduled  success
--   2026-09-01 06:00  scheduled  success
--   4 success, 0 errors
--
-- So the trigger exists, it runs, and the request succeeds. What it does is a
-- read: GET /rest/v1/track_links?select=id&limit=1. Whether Supabase counts a
-- read as activity is not something I can see from outside, and it is the only
-- assumption left standing between a working cron and a paused project.
--
-- Rather than keep guessing at their definition, the ping becomes a write. A
-- row update is a transaction in the database, and there is no plausible
-- definition of "activity" that excludes one.
--
-- It also gives the ping somewhere to record itself, so "when did this last
-- run" is answerable from the database rather than needing a KV binding.

create table if not exists keepalive (
  id         smallint primary key default 1,
  last_ping  timestamptz not null default now(),
  source     text,
  -- Guarantees exactly one row for ever, so the update can never miss and can
  -- never accumulate.
  constraint keepalive_single_row check (id = 1)
);

insert into keepalive (id, last_ping, source)
values (1, now(), 'migration')
on conflict (id) do nothing;

-- RLS on with no policies at all: the anon key cannot read or write this, and
-- the worker reaches it with the service key, which bypasses RLS. There is
-- nothing here anyone else needs.
alter table keepalive enable row level security;

-- Expect one row.
select id, last_ping, source from keepalive;
