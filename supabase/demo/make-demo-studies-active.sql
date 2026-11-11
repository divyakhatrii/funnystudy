-- Demo-only: run in YOUR teaching-copy Supabase project (SQL editor), never production.
-- Every study in the Oct 19 snapshot has already ended, so the home page would
-- only ever show "No active studies". This reopens two public studies:
--   80 = 60 image+caption pairs (good length to scroll to the end in a demo)
--    3 = 330 captions (more than one 200-caption batch, exercises lazy loading)
update public.studies
set start_datetime_utc = now() - interval '1 hour',
    end_datetime_utc   = timestamptz '2026-12-31 23:59:00-05'
where id in (80, 3);

-- To show the empty "No active studies" + text alert prompt instead, run:
-- update public.studies set end_datetime_utc = now() - interval '1 minute' where id in (80, 3);
