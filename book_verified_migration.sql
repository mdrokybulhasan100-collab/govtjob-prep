-- Add a persistent book-verification toggle for questions in Admin > প্রশ্ন দেখুন.
-- Run once in Supabase SQL Editor.
alter table public.questions
  add column if not exists book_verified boolean not null default false;
