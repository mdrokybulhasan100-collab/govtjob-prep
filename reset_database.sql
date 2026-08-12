-- ============================================================
-- RESET — removes everything this app created (tables, functions,
-- the auth trigger), so you can start clean. Does NOT touch
-- Supabase's own auth system, other projects, or unrelated objects
-- you may have added yourself outside this app's schema.
--
-- Run this FIRST, then run schema.sql fresh, in Supabase SQL Editor.
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.live_exam_leaderboard(uuid);
drop function if exists public.smart_search_questions(text, int, int);
drop function if exists public.handle_new_user();

drop view if exists public.leaderboard;

drop table if exists public.topic_reads cascade;
drop table if exists public.favorites cascade;
drop table if exists public.session_answers cascade;
drop table if exists public.practice_sessions cascade;
drop table if exists public.live_exams cascade;
drop table if exists public.questions cascade;
drop table if exists public.topics cascade;
drop table if exists public.exams cascade;
drop table if exists public.subjects cascade;
drop table if exists public.profiles cascade;
