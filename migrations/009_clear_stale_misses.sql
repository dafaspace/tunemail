-- Retire the "not findable" markers written by code that could not look.
--
-- track_links.enrich_missed_at means "we asked about this name and nobody had
-- it, do not ask again for a month". Sound idea. But all four markers in the
-- table were written on 21 August, and on 21 August:
--
--   - every Deezer call from the page failed with a CORS error, so the Deezer
--     half of the lookup was not being asked at all, only failing silently
--   - ISRC discovery did not exist, so a track with no code had only its name
--
-- So the marker does not record "this recording cannot be found". It records
-- "the broken version of this lookup did not find it". Two of the four are
-- Dave Brubeck's 40 Days and Fats Waller's I Can't Break the Habit of You, and
-- both now resolve to an exact Apple link with artwork through their ISRC.
--
-- Four rows, so four lookups get re-tried once. That is the entire cost.

update track_links
   set enrich_missed_at = null
 where enrich_missed_at is not null
   and enrich_missed_at < '2026-08-25';

-- Expect 0.
select count(*) as still_marked from track_links where enrich_missed_at is not null;
