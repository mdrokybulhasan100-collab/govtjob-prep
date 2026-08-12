-- ============================================================
-- Migration: Practice restructure — Flashcard/Direct MCQ practice
-- with "জানতাম/জানতাম না" tracking, fixed Live Exam question sets
-- with subject-wise composition, Exam Archive sourced from archived
-- Live Exams, and Quiz Builder becoming MCQ-only/exam-style.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. "জানতাম/জানতাম না" tracking (replaces the old ⭐ favorites concept —
--    the ★ button now marks a question as "didn't know" too, same table).
create table if not exists public.question_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  status text not null check (status in ('known', 'unknown')),
  updated_at timestamptz default now(),
  unique (user_id, question_id)
);

alter table public.question_knowledge enable row level security;
drop policy if exists "question_knowledge_own" on public.question_knowledge;
create policy "question_knowledge_own" on public.question_knowledge for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Allow a generic 'practice' session mode (flashcard/direct-mcq
--    practice — no score is recorded for these, only time).
alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live', 'practice'));

-- 3. Live Exam: fixed question set (chosen once, same for everyone) +
--    optional subject/chapter weighted composition + archive flag.
alter table public.live_exams add column if not exists question_ids uuid[];
alter table public.live_exams add column if not exists composition jsonb;
alter table public.live_exams add column if not exists archived boolean default false;

-- 4. Quiz Builder is now MCQ-only by design (enforced in the app, not
--    the DB, since short-answer questions must remain valid data for
--    Practice). No schema change needed for that — noted here for context.
