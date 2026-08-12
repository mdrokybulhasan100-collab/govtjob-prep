-- ============================================================
-- Migration: Live Exam — scheduled, synchronized exams with a
-- privacy-preserving leaderboard (rank + score only, never names,
-- emails, or user IDs).
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Scheduled live exams (created by admins)
create table if not exists public.live_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_id uuid references public.exams(id) on delete set null,       -- optional: reuse an existing exam's questions
  subject_id uuid references public.subjects(id) on delete set null, -- optional: or pull random from one subject
  start_at timestamptz not null,
  duration_minutes int not null default 30,
  question_count int not null default 20,
  created_at timestamptz default now()
);

alter table public.live_exams enable row level security;

drop policy if exists "live_exams_read" on public.live_exams;
create policy "live_exams_read" on public.live_exams for select using (auth.role() = 'authenticated');

drop policy if exists "live_exams_write_admin" on public.live_exams;
create policy "live_exams_write_admin" on public.live_exams for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "live_exams_update_admin" on public.live_exams;
create policy "live_exams_update_admin" on public.live_exams for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "live_exams_delete_admin" on public.live_exams;
create policy "live_exams_delete_admin" on public.live_exams for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 2. Link practice_sessions to a live exam, and allow a 'live' mode
alter table public.practice_sessions add column if not exists live_exam_id uuid references public.live_exams(id) on delete set null;

alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live'));

-- 3. Privacy-preserving leaderboard function.
--    SECURITY DEFINER lets this read across all users' sessions (bypassing
--    each user's own RLS), but the function ONLY EVER returns rank, score,
--    and whether a row belongs to the caller — never user_id, email, or name.
create or replace function public.live_exam_leaderboard(p_live_exam_id uuid)
returns table (
  rank bigint,
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
    ps.correct_answers,
    ps.total_questions,
    (ps.user_id = auth.uid()) as is_me
  from public.practice_sessions ps
  where ps.live_exam_id = p_live_exam_id
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
