-- 012 - public_slug can only ever hold a slug
--
-- Why this exists. Four render sites pasted public_slug straight into inline
-- onclick handlers while every sibling value on the same card went through
-- escHtml. That is stored XSS reaching every visitor to Discover and to any
-- ?u= profile page, and it was reachable rather than theoretical: generateSlug
-- decides what the APP writes, not what the COLUMN can hold. The owner may
-- update their own row - the app does exactly that when a playlist is made
-- public - and the anon key is printed in index.html, so any account could
-- PATCH its own slug to a payload through PostgREST.
--
-- The client is fixed in v76 (data attributes, one delegated listener, and a
-- render-time guard). This is the other half: the database refusing to hold
-- anything that is not a slug, so the next render site written by someone in a
-- hurry cannot reintroduce it.
--
-- Run this in Supabase -> SQL Editor. It is safe to run twice.

-- 1. Look before changing anything. This must return zero rows; if it does not,
--    those rows have to be dealt with before the constraint can be added.
select id, user_id, is_public, public_slug, length(public_slug) as len
  from music_playlists
 where public_slug is not null
   and public_slug !~ '^[a-z0-9]{6,16}$';

-- 2. The constraint. NULL stays allowed: a private playlist has no slug.
alter table music_playlists
  drop constraint if exists music_playlists_public_slug_shape;

alter table music_playlists
  add constraint music_playlists_public_slug_shape
  check (public_slug is null or public_slug ~ '^[a-z0-9]{6,16}$');

-- 3. A shared link must also be unique, or two playlists answer the same URL
--    and which one a recipient sees depends on row order.
create unique index if not exists music_playlists_public_slug_key
  on music_playlists (public_slug)
  where public_slug is not null;

-- 4. Confirm. Expect one check constraint and one unique index.
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'music_playlists'::regclass
   and conname = 'music_playlists_public_slug_shape';

select indexname, indexdef
  from pg_indexes
 where tablename = 'music_playlists'
   and indexname = 'music_playlists_public_slug_key';
