-- ============================================================
-- Migration: Quiz Builder — allow a 'custom' practice session mode
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom'));
