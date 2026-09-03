-- Remember which Telegram message announced which report.
--
-- The notification currently opens with a raw uuid on its own line, because
-- that is how the reply handler knows which report is being answered: it reads
-- the id back out of `reply_to_message.text`. It works, and it puts a 36
-- character identifier at the top of every message a person reads on a phone.
--
-- The id was placed first deliberately - the regex takes the first match, and
-- everything after it is text the user wrote, so a report containing
-- "id:<some uuid>" could otherwise redirect the reply to somebody else's row.
-- Putting it first was the fix for that. Storing it here removes the problem
-- rather than defending against it: a Telegram message_id is assigned by
-- Telegram and cannot be typed into a feedback form at all.

alter table feedback
  add column if not exists telegram_message_id bigint;

-- The reply handler looks the row up by this, so it wants an index. Partial,
-- because most rows never get one: only the ones that produced a notification.
create index if not exists feedback_telegram_message_id_idx
  on feedback (telegram_message_id)
  where telegram_message_id is not null;

-- Reports announced before this migration carry the id in their message text,
-- and the worker keeps the old text-parsing path as a fallback, so replying to
-- an older notification still works.
