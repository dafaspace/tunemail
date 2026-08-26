-- Three playlists called JAZZ. Keep the one with 41 tracks, drop the rest, and
-- carry the share link across so it does not die with the playlist it is
-- currently attached to.
--
-- The link is the reason this is not just two deletes. public_slug 'vtnzw3pu'
-- is live at link.tunemail.app/p/vtnzw3pu and may be sitting in somebody's
-- chat. Deleting the playlist that holds it breaks that link permanently: a new
-- playlist gets a new slug and there is no way to reassign the old one from the
-- app.
--
-- Nothing here needs an id typed in. The keeper is identified by having the most
-- tracks, which is what "the one with 41" means, so there is no id to copy
-- wrongly at two in the morning.

-- ── STEP 1: look first. Run this on its own and read it. ────────────────────
-- Expect three rows: 41 tracks, 35 tracks (this is the one holding the slug),
-- and one with 0. If that is not what comes back, stop and do not run step 2.

select p.id,
       p.name,
       p.is_public,
       p.public_slug,
       p.created_at::date as created,
       count(t.id)        as tracks
  from music_playlists p
  left join playlist_tracks t on t.playlist_id = p.id
 where p.user_id = '7a576878-21bd-42a3-b893-b0ccdc971281'
   and p.name ilike '%jazz%'
 group by p.id
 order by tracks desc;


-- ── STEP 2: move the link, then delete. One transaction. ───────────────────
-- Run this only after step 1 showed what you expected.

begin;

-- The slug is unique, so it has to be released before it can be taken.
-- Ordering matters here and this is the only reason for the temp table: both
-- statements need the same idea of "which one is the keeper", and the second
-- runs after the first has already changed the rows the query would look at.
create temp table _jazz on commit drop as
  select p.id, count(t.id) as tracks
    from music_playlists p
    left join playlist_tracks t on t.playlist_id = p.id
   where p.user_id = '7a576878-21bd-42a3-b893-b0ccdc971281'
     and p.name ilike '%jazz%'
   group by p.id;

-- Guard: if there are not at least two, something is not as expected and
-- nothing should happen.
do $$
begin
  if (select count(*) from _jazz) < 2 then
    raise exception 'Expected more than one JAZZ playlist, found %', (select count(*) from _jazz);
  end if;
end $$;

-- Release the slug from whoever holds it.
update music_playlists
   set public_slug = null,
       is_public   = false
 where id in (select id from _jazz)
   and id <> (select id from _jazz order by tracks desc limit 1);

-- Give it to the keeper, and make it public so the link resolves.
update music_playlists
   set public_slug = 'vtnzw3pu',
       is_public   = true
 where id = (select id from _jazz order by tracks desc limit 1);

-- Everything else called JAZZ goes. playlist_tracks cascades from
-- music_playlists, so the tracks follow without being named here.
delete from music_playlists
 where id in (select id from _jazz)
   and id <> (select id from _jazz order by tracks desc limit 1);

commit;


-- ── STEP 3: check. Expect exactly one row, 41 tracks, slug vtnzw3pu. ────────

select p.id, p.name, p.is_public, p.public_slug,
       count(t.id) filter (where t.id is not null)   as tracks,
       count(t.isrc) filter (where t.isrc is not null) as with_isrc
  from music_playlists p
  left join playlist_tracks t on t.playlist_id = p.id
 where p.user_id = '7a576878-21bd-42a3-b893-b0ccdc971281'
   and p.name ilike '%jazz%'
 group by p.id;

-- with_isrc will be 0 at this point. Open the playlist in the app while signed
-- in and the backfill fills it, saying how many it wrote. Migration 006 is now
-- dead: it names track ids belonging to the 35-track playlist that this file
-- deletes.
