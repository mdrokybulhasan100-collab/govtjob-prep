-- ============================================================
-- Migration: Topic Guru — nested subtopics + read-progress tracking
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Allow topics to nest under a parent topic (subtopics, sub-subtopics...)
--    e.g. বাংলা সাহিত্য -> আধুনিক যুগ -> রবীন্দ্রনাথ ঠাকুর
alter table public.topics add column if not exists parent_topic_id uuid references public.topics(id) on delete cascade;

-- 2. Track which topics a user has opened/studied (for progress display).
--    Private per user — RLS ensures no one sees anyone else's reading history.
create table if not exists public.topic_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, topic_id)
);

alter table public.topic_reads enable row level security;

drop policy if exists "topic_reads_own" on public.topic_reads;
create policy "topic_reads_own" on public.topic_reads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
