-- Close the feedback screenshot bucket.
--
-- Migration 005 created it public, on the reasoning that the path carries a
-- uuid and a millisecond timestamp and so is not guessable. That reasoning was
-- weak and it is being withdrawn.
--
-- The uuid half is not secret: it is profiles.id, which is readable for anyone
-- who has shared a public playlist. That leaves a millisecond within a day the
-- attacker can usually guess - 86.4 million values, which is a long afternoon
-- rather than a wall. And the object is a picture of somebody's own screen,
-- sent privately to report a fault. It should not be one guessed URL from being
-- public, however long that guess takes.
--
-- The Cinemail session measured the same bucket shape over there and found the
-- public URL served with no apikey and no Authorization header at all. Same
-- ancestry, same defect; fixed in both or it is not fixed.

update storage.buckets
   set public = false
 where id = 'feedback-screenshots';

-- With the bucket private, reads go through a signed URL, and signing requires
-- the caller to be allowed to select the row. Scoped to the uploader's own
-- folder: nobody has any business reading anyone else's.
drop policy if exists "feedback shots: own folder select" on storage.objects;
create policy "feedback shots: own folder select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deleting your own message should take its picture with it. Without this the
-- row goes and the file stays, which is the same orphaning that account
-- deletion had, just at a smaller scale.
drop policy if exists "feedback shots: own folder delete" on storage.objects;
create policy "feedback shots: own folder delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Still no update policy: a report should not be editable after it is sent.

-- Rows written before this migration hold a full public URL rather than a path.
-- They are left as they are and read as URLs by the client, which handles both
-- shapes. Rewriting them would be a lie about what they were.
