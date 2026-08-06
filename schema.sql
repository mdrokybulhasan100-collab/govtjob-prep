-- ============================================================
-- Sorkari Chakri Prep — Supabase Schema (v2, private data only)
-- Paste this whole file into: Supabase Dashboard > SQL Editor > New query > Run
--
-- Data isolation guarantee:
--   - Every user can ONLY ever see, insert, or update their OWN
--     profile, practice sessions, and answers.
--   - There is no view, table, or policy anywhere that exposes
--     one user's data to another user.
--   - subjects/topics/exams/questions are the shared QUESTION
--     BANK content (not personal data) — every logged-in user
--     can read them, nobody can see anyone else's answers/scores.
-- ============================================================

-- 1. PROFILES (extends auth.users, created automatically on signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. SUBJECTS
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null,
  name_en text not null,
  slug text unique not null,
  icon text default '📘',
  sort_order int default 0
);

-- 3. TOPICS (can nest under a parent topic for Topic Guru's sub-topic tree)
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
  parent_topic_id uuid references public.topics(id) on delete cascade,
  name_bn text not null,
  name_en text not null,
  sort_order int default 0
);

-- 4. EXAMS (previous year question papers)
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  year int,
  slug text unique not null
);

-- 5. QUESTIONS
-- question_type = 'mcq' (default) or 'short'.
--   mcq   -> uses option_a..d + correct_option
--   short -> uses short_answer (a plain text answer, e.g. "ঢাকা")
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,
  question_type text not null default 'mcq' check (question_type in ('mcq','short')),
  question_text text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text check (correct_option is null or correct_option in ('a','b','c','d')),
  short_answer text,
  explanation text,
  created_at timestamptz default now()
);

-- 6. PRACTICE SESSIONS (private — one row per quiz attempt, owned by one user)
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('all','subject','topic','exam','custom','live')),
  subject_id uuid references public.subjects(id),
  topic_id uuid references public.topics(id),
  exam_id uuid references public.exams(id),
  total_questions int default 0,
  correct_answers int default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- 7. SESSION ANSWERS (private — belongs to one session, which belongs to one user)
create table if not exists public.session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.practice_sessions(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  selected_option text check (selected_option in ('a','b','c','d')),
  is_correct boolean
);

-- ============================================================
-- ROW LEVEL SECURITY — this is what guarantees the data isolation
-- ============================================================
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.session_answers enable row level security;

-- Profiles: a user can ONLY see/update their OWN profile row
drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Subjects/Topics/Exams/Questions: shared question-bank content, read-only for all logged-in users
drop policy if exists "subjects_read" on public.subjects;
create policy "subjects_read" on public.subjects for select using (auth.role() = 'authenticated');
drop policy if exists "topics_read" on public.topics;
create policy "topics_read" on public.topics for select using (auth.role() = 'authenticated');
drop policy if exists "exams_read" on public.exams;
create policy "exams_read" on public.exams for select using (auth.role() = 'authenticated');
drop policy if exists "questions_read" on public.questions;
create policy "questions_read" on public.questions for select using (auth.role() = 'authenticated');

-- Practice sessions: STRICTLY own rows only (select/insert/update/delete)
drop policy if exists "sessions_own" on public.practice_sessions;
create policy "sessions_own" on public.practice_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Session answers: STRICTLY answers belonging to the caller's own sessions
drop policy if exists "answers_own" on public.session_answers;
create policy "answers_own" on public.session_answers for all using (
  exists (select 1 from public.practice_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.practice_sessions s where s.id = session_id and s.user_id = auth.uid())
);

-- NOTE: There is intentionally no "leaderboard" or any other view/policy
-- that aggregates or exposes data across users. Each user's practice
-- history is visible to that user and only that user.

-- Content tables (subjects/topics/exams/questions) can be WRITTEN only by
-- users whose profile has is_admin = true. Reading stays open to everyone
-- logged in (policies above). See admin_migration.sql for how to make
-- yourself an admin after your first login.
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
-- SAMPLE DATA (subjects + topics + a few sample questions to test with)
-- Delete/replace once you add your own real question bank.
-- ============================================================
insert into public.subjects (name_bn, name_en, slug, icon, sort_order) values
  ('বাংলা', 'Bangla', 'bangla', '📗', 1),
  ('ইংরেজি', 'English', 'english', '📘', 2),
  ('গণিত', 'Math', 'math', '🔢', 3),
  ('সাধারণ জ্ঞান', 'General Knowledge', 'gk', '🌍', 4),
  ('বিজ্ঞান ও প্রযুক্তি', 'Science & Tech', 'science', '🔬', 5),
  ('কম্পিউটার', 'Computer', 'computer', '💻', 6)
on conflict (slug) do nothing;

insert into public.topics (subject_id, name_bn, name_en, sort_order)
select id, 'ব্যাকরণ', 'Grammar', 1 from public.subjects where slug = 'bangla'
union all
select id, 'সাহিত্য', 'Literature', 2 from public.subjects where slug = 'bangla'
union all
select id, 'Grammar', 'Grammar', 1 from public.subjects where slug = 'english'
union all
select id, 'Vocabulary', 'Vocabulary', 2 from public.subjects where slug = 'english'
union all
select id, 'পাটিগণিত', 'Arithmetic', 1 from public.subjects where slug = 'math'
union all
select id, 'বীজগণিত', 'Algebra', 2 from public.subjects where slug = 'math'
union all
select id, 'বাংলাদেশ বিষয়াবলি', 'Bangladesh Affairs', 1 from public.subjects where slug = 'gk'
union all
select id, 'আন্তর্জাতিক বিষয়াবলি', 'International Affairs', 2 from public.subjects where slug = 'gk';

insert into public.exams (name, organization, year, slug) values
  ('৪৩তম বিসিএস প্রিলিমিনারি', 'BPSC', 2023, 'bcs-43-preli'),
  ('৪২তম বিসিএস প্রিলিমিনারি', 'BPSC', 2021, 'bcs-42-preli'),
  ('সিনিয়র অফিসার (ক্যাশ)', 'Combined Bank', 2022, 'bank-so-cash-2022')
on conflict (slug) do nothing;

insert into public.questions (subject_id, topic_id, exam_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select s.id, t.id, e.id, 'mcq',
  '"সমাস" শব্দটির আভিধানিক অর্থ কী?',
  'বিস্তার', 'সংক্ষেপণ', 'বিভাজন', 'সংযোজন',
  'b', 'সমাস শব্দের আভিধানিক অর্থ সংক্ষেপণ — একাধিক পদকে একপদে পরিণত করা।'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Grammar' and s.slug = 'bangla'
left join public.exams e on e.slug = 'bcs-43-preli'
where s.slug = 'bangla' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select s.id, t.id, null, 'mcq',
  'Choose the correct synonym of "Ubiquitous":',
  'Rare', 'Omnipresent', 'Hidden', 'Ancient',
  'b', '"Ubiquitous" means present everywhere, so the closest synonym is "Omnipresent".'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Vocabulary' and s.slug = 'english'
where s.slug = 'english' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select s.id, t.id, null, 'mcq',
  'একটি সংখ্যার ২৫% যদি ৫০ হয়, তবে সংখ্যাটি কত?',
  '১৫০', '২০০', '২৫০', '৩০০',
  'b', '৫০ ÷ ২৫ × ১০০ = ২০০'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Arithmetic' and s.slug = 'math'
where s.slug = 'math' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_type, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
select s.id, t.id, e.id, 'mcq',
  'বাংলাদেশের সংবিধান কার্যকর হয় কবে?',
  '১৬ ডিসেম্বর ১৯৭২', '৪ নভেম্বর ১৯৭২', '২৬ মার্চ ১৯৭২', '১ জানুয়ারি ১৯৭৩',
  'a', 'বাংলাদেশের সংবিধান ৪ নভেম্বর ১৯৭২ গৃহীত হয় এবং ১৬ ডিসেম্বর ১৯৭২ থেকে কার্যকর হয়।'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Bangladesh Affairs' and s.slug = 'gk'
left join public.exams e on e.slug = 'bcs-42-preli'
where s.slug = 'gk' limit 1;

-- short-answer example
insert into public.questions (subject_id, topic_id, exam_id, question_type, question_text, short_answer, explanation)
select s.id, t.id, null, 'short',
  'বাংলাদেশের রাজধানীর নাম কী?',
  'ঢাকা', null
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Bangladesh Affairs' and s.slug = 'gk'
where s.slug = 'gk' limit 1;
-- ============================================================
-- Migration: Smart Search (typo-tolerant question search) + Favorites
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Enable trigram matching (needed for "works even with typos")
create extension if not exists pg_trgm;

-- Speeds up fuzzy matching on question text as the question bank grows
create index if not exists questions_text_trgm_idx
  on public.questions using gin (question_text gin_trgm_ops);

-- 2. Search function: matches on question text, subject name, or topic
--    name — substring match OR trigram similarity (typo-tolerant), ranked
--    by relevance. Runs with the caller's own permissions (respects RLS
--    on the underlying tables — no elevated access).
create or replace function public.smart_search_questions(
  p_search text,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  subject_id uuid,
  topic_id uuid,
  exam_id uuid,
  question_type text,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  short_answer text,
  explanation text,
  created_at timestamptz,
  subject_name text,
  topic_name text,
  exam_name text,
  match_rank real
)
language sql stable as $$
  select
    q.id, q.subject_id, q.topic_id, q.exam_id, q.question_type,
    q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
    q.correct_option, q.short_answer, q.explanation, q.created_at,
    s.name_bn as subject_name, t.name_bn as topic_name, e.name as exam_name,
    greatest(
      similarity(q.question_text, p_search),
      similarity(coalesce(s.name_bn, ''), p_search),
      similarity(coalesce(t.name_bn, ''), p_search)
    ) as match_rank
  from public.questions q
  left join public.subjects s on s.id = q.subject_id
  left join public.topics t on t.id = q.topic_id
  left join public.exams e on e.id = q.exam_id
  where
    p_search is not null and length(trim(p_search)) > 0
    and (
      q.question_text ilike '%' || p_search || '%'
      or coalesce(s.name_bn, '') ilike '%' || p_search || '%'
      or coalesce(s.name_en, '') ilike '%' || p_search || '%'
      or coalesce(t.name_bn, '') ilike '%' || p_search || '%'
      or coalesce(t.name_en, '') ilike '%' || p_search || '%'
      or similarity(q.question_text, p_search) > 0.2
    )
  order by match_rank desc nulls last, q.created_at desc
  limit p_limit offset p_offset;
$$;

grant execute on function public.smart_search_questions(text, int, int) to authenticated;

-- 3. Favorites — each user can bookmark questions for later revision.
--    Strictly private: RLS ensures a user only ever sees/edits their own.
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, question_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
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
-- ============================================================
-- Migration: Live Exam — scheduled, synchronized exams with a
-- privacy-preserving leaderboard (rank + score only, never names,
-- emails, or user IDs).
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Scheduled live exams (created by admins)
create table if not exists public.live_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_id uuid references public.exams(id) on delete set null,       -- optional: reuse an existing exam's questions
  subject_id uuid references public.subjects(id) on delete set null, -- optional: or pull random from one subject
  start_at timestamptz not null,
  duration_minutes int not null default 30,
  question_count int not null default 20,
  created_at timestamptz default now()
);

alter table public.live_exams enable row level security;

drop policy if exists "live_exams_read" on public.live_exams;
create policy "live_exams_read" on public.live_exams for select using (auth.role() = 'authenticated');

drop policy if exists "live_exams_write_admin" on public.live_exams;
create policy "live_exams_write_admin" on public.live_exams for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "live_exams_update_admin" on public.live_exams;
create policy "live_exams_update_admin" on public.live_exams for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "live_exams_delete_admin" on public.live_exams;
create policy "live_exams_delete_admin" on public.live_exams for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 2. Link practice_sessions to a live exam, and allow a 'live' mode
alter table public.practice_sessions add column if not exists live_exam_id uuid references public.live_exams(id) on delete set null;

alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live'));

-- 3. Privacy-preserving leaderboard function.
--    SECURITY DEFINER lets this read across all users' sessions (bypassing
--    each user's own RLS), but the function ONLY EVER returns rank, score,
--    and whether a row belongs to the caller — never user_id, email, or name.
create or replace function public.live_exam_leaderboard(p_live_exam_id uuid)
returns table (
  rank bigint,
  correct_answers int,
  total_questions int,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by ps.correct_answers desc, ps.completed_at asc) as rank,
    ps.correct_answers,
    ps.total_questions,
    (ps.user_id = auth.uid()) as is_me
  from public.practice_sessions ps
  where ps.live_exam_id = p_live_exam_id
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
-- ============================================================
-- Migration: Live Exam leaderboard — show names (deliberate,
-- scoped ONLY to the Live Exam leaderboard). Everything else
-- (personal practice history, dashboard stats, favorites, etc.)
-- remains fully private as before — this does not change that.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

drop function if exists public.live_exam_leaderboard(uuid);

create or replace function public.live_exam_leaderboard(p_live_exam_id uuid)
returns table (
  rank bigint,
  full_name text,
  correct_answers int,
  total_questions int,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by ps.correct_answers desc, ps.completed_at asc) as rank,
    coalesce(p.full_name, p.email, 'বেনামী') as full_name,
    ps.correct_answers,
    ps.total_questions,
    (ps.user_id = auth.uid()) as is_me
  from public.practice_sessions ps
  join public.profiles p on p.id = ps.user_id
  where ps.live_exam_id = p_live_exam_id
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
