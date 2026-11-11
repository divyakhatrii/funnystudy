-- Demo-only: run in YOUR teaching-copy Supabase project (SQL editor), never production.
-- Every study in the Oct 19 snapshot has already ended, so the home page would
-- only ever show "No active studies". This reopens the two most recent public
-- studies, which are the usual size (about 20 captions):
--   122 = 22 image+caption pairs (Oct 2026)
--   117 = 23 image+caption pairs (Oct 2026)
-- and closes 80 and 3 in case an earlier version of this script opened them.
update public.studies
set start_datetime_utc = now() - interval '1 hour',
    end_datetime_utc   = timestamptz '2026-12-31 23:59:00-05'
where id in (122, 117);

update public.studies
set end_datetime_utc = timestamptz '2026-11-11 00:00:00-05'
where id in (80, 3) and end_datetime_utc > now();

-- To show the empty "No active studies" + text alert prompt instead, run:
-- update public.studies set end_datetime_utc = now() - interval '1 minute' where id in (122, 117);
