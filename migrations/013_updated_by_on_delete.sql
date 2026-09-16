-- 013 - deleting an account must not be blocked by a link correction
--
-- track_links.updated_by references auth.users(id) with NO on-delete clause
-- (migrations/002_link_review.sql:13), so Postgres defaults it to NO ACTION.
-- That means the row REFUSES to let the user be deleted.
--
-- The consequence is specific and bad: anyone who has ever corrected a platform
-- link cannot delete their account. The worker's /delete-account calls Supabase's
-- auth admin delete, the foreign key refuses, and the person sees "Could not
-- delete" with no way forward. In-app account deletion is required by App Store
-- 5.1.1(v), so this is a rejection as well as a broken promise.
--
-- SET NULL rather than CASCADE, deliberately. track_links rows are SHARED: they
-- are what every other user sees for that recording. Cascading would delete a
-- correction that is still right and still useful to strangers, because the
-- person who made it left. The attribution goes; the fact stays.
--
-- Migration 004 gave profiles and the playlist tables their cascades and missed
-- this one, which is why it survived.
--
-- Run in Supabase -> SQL Editor. Safe to run twice.

-- 1. Look first. Rows whose author is already gone would have blocked the
--    delete; there should be none, because the delete would have failed.
select count(*) as corrections_with_an_author
  from track_links
 where updated_by is not null;

-- 2. Find the constraint's real name rather than guessing it - Postgres names
--    these itself and the name differs between projects.
select conname
  from pg_constraint
 where conrelid = 'track_links'::regclass
   and contype = 'f'
   and pg_get_constraintdef(oid) like '%updated_by%';

-- 3. Replace it. The DO block reads the name from the catalogue so this works
--    whatever Postgres called it.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
    from pg_constraint
   where conrelid = 'track_links'::regclass
     and contype = 'f'
     and pg_get_constraintdef(oid) like '%updated_by%'
   limit 1;

  if fk_name is not null then
    execute format('alter table track_links drop constraint %I', fk_name);
  end if;

  alter table track_links
    add constraint track_links_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;
end $$;

-- 4. Confirm. Expect one row, ending in ON DELETE SET NULL.
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'track_links'::regclass
   and contype = 'f'
   and pg_get_constraintdef(oid) like '%updated_by%';
