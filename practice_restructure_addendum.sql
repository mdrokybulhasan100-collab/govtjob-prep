-- ============================================================
-- Addendum to practice_restructure_migration.sql:
-- - Adds 'examarchive' as a distinct session mode (so replaying an
--   archived exam doesn't get counted in the original live event's
--   ranking).
-- - Updates the leaderboard function to only count actual 'live'
--   attempts, not later archive practice.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live', 'practice', 'examarchive'));

drop function if exists public.live_exam_leaderboard(uuid);

create or replace function public.live_exam_leaderboard(p_live_exam_id uuid)
returns table (
  rank bigint,
  full_name text,
  correct_answers int,
  total_questions int,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by ps.correct_answers desc, ps.completed_at asc) as rank,
    coalesce(p.full_name, p.email, 'বেনামী') as full_name,
    ps.correct_answers,
    ps.total_questions,
    (ps.user_id = auth.uid()) as is_me
  from public.practice_sessions ps
  join public.profiles p on p.id = ps.user_id
  where ps.live_exam_id = p_live_exam_id
    and ps.mode = 'live'
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
