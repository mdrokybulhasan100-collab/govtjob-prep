-- Add source book and page metadata to questions. Safe to run more than once.
alter table public.questions
  add column if not exists book_name text,
  add column if not exists book_page integer;
