-- ============================================================
-- Migration: Question types (MCQ + Short Answer) + drop difficulty
-- Paste into Supabase SQL Editor > New query > Run.
-- Safe to re-run.
-- ============================================================

-- 1. Question type column ('mcq' | 'short'). Existing rows default to 'mcq'.
alter table public.questions add column if not exists question_type text default 'mcq';

alter table public.questions drop constraint if exists questions_question_type_check;
alter table public.questions add constraint questions_question_type_check
  check (question_type in ('mcq', 'short'));

-- 2. Short-answer text column (used when question_type = 'short')
alter table public.questions add column if not exists short_answer text;

-- 3. MCQ fields are no longer required at the database level, since a
--    short-answer question won't have options or a correct_option.
alter table public.questions alter column option_a drop not null;
alter table public.questions alter column option_b drop not null;
alter table public.questions alter column option_c drop not null;
alter table public.questions alter column option_d drop not null;
alter table public.questions alter column correct_option drop not null;

-- 4. Difficulty is no longer used — remove the column entirely.
alter table public.questions drop column if exists difficulty;
