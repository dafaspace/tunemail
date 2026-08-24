-- Feedback screenshots.
--
-- Every useful bug report this project has received arrived as a picture. A
-- sentence saying "the button looks wrong" costs a round trip to answer; the
-- same report with a screenshot is actionable on arrival. Cinemail already has
-- this and Tunemail did not, so the two are brought back in line.

-- Where the URL is kept. Nullable: most feedback is text only.
alter table feedback
  add column if not exists screenshot_url text;

-- The bucket is public for reading. The alternative - signed URLs - would mean
-- the link in the Telegram notification expires, and a bug report that cannot
-- be looked at a week later is worth much less. The path is a uuid plus a
-- millisecond timestamp, so it is not guessable in practice.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  true,
  5242880,                                      -- 5 MB, matching the client check
  array['image/png','image/jpeg','image/webp','image/gif','image/heic']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Writing is restricted to signed-in people, and each one may only write inside
-- a folder named after their own user id. Without the folder check any account
-- could overwrite somebody else's upload, which is how a shared bucket turns
-- into a way to serve arbitrary files from a trusted-looking host.
drop policy if exists "feedback shots: own folder insert" on storage.objects;
create policy "feedback shots: own folder insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No update and no delete policy on purpose: a report should not be editable
-- after it has been sent, and nothing in the app needs to remove one.
