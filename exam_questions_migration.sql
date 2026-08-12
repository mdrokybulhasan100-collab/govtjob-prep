-- ============================================================
-- Migration: Allow questions without a subject (exam-only questions)
-- Paste into Supabase SQL Editor > New query > Run.
-- Safe to re-run.
--
-- Why: previous-year exam papers should be uploadable right away
-- (just tagged with an exam) without first sorting every question
-- into a subject/topic. Subject-wise tagging can be added later.
-- ============================================================

alter table public.questions alter column subject_id drop not null;
