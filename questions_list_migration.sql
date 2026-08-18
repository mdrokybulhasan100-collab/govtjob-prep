-- ============================================================
-- Migration: created_at timestamp on questions (so Admin Panel
-- can list them newest-first)
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

alter table public.questions add column if not exists created_at timestamptz default now();
