-- ============================================================
-- Migration: Admin support
-- Paste into Supabase SQL Editor > New query > Run.
-- Safe to run even if you already ran the original schema.sql.
-- ============================================================

-- 1. Add is_admin flag to profiles (defaults to false for everyone)
alter table public.profiles add column if not exists is_admin boolean default false;

-- 2. Allow content tables (subjects/topics/exams/questions) to be
--    written ONLY by users whose profile has is_admin = true.
--    Reading stays open to all logged-in users (unchanged).

drop policy if exists "subjects_write_admin" on public.subjects;
create policy "subjects_write_admin" on public.subjects for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "subjects_update_admin" on public.subjects;
create policy "subjects_update_admin" on public.subjects for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "subjects_delete_admin" on public.subjects;
create policy "subjects_delete_admin" on public.subjects for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "topics_write_admin" on public.topics;
create policy "topics_write_admin" on public.topics for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "topics_update_admin" on public.topics;
create policy "topics_update_admin" on public.topics for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "topics_delete_admin" on public.topics;
create policy "topics_delete_admin" on public.topics for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "exams_write_admin" on public.exams;
create policy "exams_write_admin" on public.exams for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "exams_update_admin" on public.exams;
create policy "exams_update_admin" on public.exams for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "exams_delete_admin" on public.exams;
create policy "exams_delete_admin" on public.exams for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "questions_write_admin" on public.questions;
create policy "questions_write_admin" on public.questions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "questions_update_admin" on public.questions;
create policy "questions_update_admin" on public.questions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "questions_delete_admin" on public.questions;
create policy "questions_delete_admin" on public.questions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ============================================================
-- 3. Make yourself admin
-- Run this AFTER you have logged into the live app at least once
-- with your Gmail (so a profiles row exists for you). Replace the
-- email below with your own.
-- ============================================================
 update public.profiles set is_admin = true where email = 'rokybulhasan40@gmail.com';
