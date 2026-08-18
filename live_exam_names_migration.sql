-- ============================================================
-- Migration: Live Exam leaderboard — show names (deliberate,
-- scoped ONLY to the Live Exam leaderboard). Everything else
-- (personal practice history, dashboard stats, favorites, etc.)
-- remains fully private as before — this does not change that.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

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
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
