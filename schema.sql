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
  'ঢাকা, Dhaka, dhaka', null
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
-- ============================================================
-- Migration: Dashboard extras — job circular announcements +
-- daily GK facts (both admin-managed, publicly readable content,
-- not personal/user data).
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Job circular / announcement feed
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  source text,
  published_at date default current_date,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select using (auth.role() = 'authenticated');

drop policy if exists "announcements_write_admin" on public.announcements;
create policy "announcements_write_admin" on public.announcements for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "announcements_update_admin" on public.announcements;
create policy "announcements_update_admin" on public.announcements for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "announcements_delete_admin" on public.announcements;
create policy "announcements_delete_admin" on public.announcements for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 2. Daily GK / current affairs fact cards
create table if not exists public.daily_facts (
  id uuid primary key default gen_random_uuid(),
  fact_bn text not null,
  category text,
  created_at timestamptz default now()
);

alter table public.daily_facts enable row level security;

drop policy if exists "daily_facts_read" on public.daily_facts;
create policy "daily_facts_read" on public.daily_facts for select using (auth.role() = 'authenticated');

drop policy if exists "daily_facts_write_admin" on public.daily_facts;
create policy "daily_facts_write_admin" on public.daily_facts for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "daily_facts_update_admin" on public.daily_facts;
create policy "daily_facts_update_admin" on public.daily_facts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "daily_facts_delete_admin" on public.daily_facts;
create policy "daily_facts_delete_admin" on public.daily_facts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 3. A few sample facts so the widget isn't empty immediately
insert into public.daily_facts (fact_bn, category) values
  ('বাংলাদেশের সংবিধান রচনা কমিটির প্রধান ছিলেন ড. কামাল হোসেন।', 'বাংলাদেশ বিষয়াবলি'),
  ('বাংলাদেশের জাতীয় সংসদ ভবনের স্থপতি লুই আই কান।', 'বাংলাদেশ বিষয়াবলি'),
  ('জাতিসংঘের সদর দপ্তর নিউইয়র্কে অবস্থিত।', 'আন্তর্জাতিক বিষয়াবলি'),
  ('বাংলাদেশের দীর্ঘতম নদী পদ্মা।', 'ভূগোল')
on conflict do nothing;
-- ============================================================
-- Migration: Editor role system + Edit permissions
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Role column (replaces is_admin as the source of truth going forward;
--    is_admin is left in place for backward compatibility but new checks
--    use `role`).
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'editor', 'admin'));

-- backfill: anyone already flagged is_admin becomes role='admin'
update public.profiles set role = 'admin' where is_admin = true and role <> 'admin';

-- 2. Editor application tracking (signing up via /editor sets these)
alter table public.profiles add column if not exists editor_status text;
alter table public.profiles drop constraint if exists profiles_editor_status_check;
alter table public.profiles add constraint profiles_editor_status_check
  check (editor_status is null or editor_status in ('pending', 'approved', 'rejected'));
alter table public.profiles add column if not exists editor_requested_at timestamptz;

-- 3. Content tables (subjects/topics/exams/questions): allow BOTH admin
--    and editor roles to write (previously admin-only). Replace the old
--    is_admin-based policies with role-based ones.

drop policy if exists "subjects_write_admin" on public.subjects;
drop policy if exists "subjects_update_admin" on public.subjects;
drop policy if exists "subjects_delete_admin" on public.subjects;
create policy "subjects_write_staff" on public.subjects for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "subjects_update_staff" on public.subjects for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "subjects_delete_staff" on public.subjects for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

drop policy if exists "topics_write_admin" on public.topics;
drop policy if exists "topics_update_admin" on public.topics;
drop policy if exists "topics_delete_admin" on public.topics;
create policy "topics_write_staff" on public.topics for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "topics_update_staff" on public.topics for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "topics_delete_staff" on public.topics for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

drop policy if exists "exams_write_admin" on public.exams;
drop policy if exists "exams_update_admin" on public.exams;
drop policy if exists "exams_delete_admin" on public.exams;
create policy "exams_write_staff" on public.exams for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "exams_update_staff" on public.exams for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "exams_delete_staff" on public.exams for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

drop policy if exists "questions_write_admin" on public.questions;
drop policy if exists "questions_update_admin" on public.questions;
drop policy if exists "questions_delete_admin" on public.questions;
create policy "questions_write_staff" on public.questions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "questions_update_staff" on public.questions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));
create policy "questions_delete_staff" on public.questions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor')));

-- 4. Admin-only tables (live_exams, announcements, daily_facts) stay
--    admin-only — update their policies to check role='admin' instead of
--    is_admin, for consistency (functionally equivalent to before).
drop policy if exists "live_exams_write_admin" on public.live_exams;
drop policy if exists "live_exams_update_admin" on public.live_exams;
drop policy if exists "live_exams_delete_admin" on public.live_exams;
create policy "live_exams_write_admin" on public.live_exams for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "live_exams_update_admin" on public.live_exams for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "live_exams_delete_admin" on public.live_exams for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "announcements_write_admin" on public.announcements;
drop policy if exists "announcements_update_admin" on public.announcements;
drop policy if exists "announcements_delete_admin" on public.announcements;
create policy "announcements_write_admin" on public.announcements for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "announcements_update_admin" on public.announcements for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "announcements_delete_admin" on public.announcements for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "daily_facts_write_admin" on public.daily_facts;
drop policy if exists "daily_facts_update_admin" on public.daily_facts;
drop policy if exists "daily_facts_delete_admin" on public.daily_facts;
create policy "daily_facts_write_admin" on public.daily_facts for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "daily_facts_update_admin" on public.daily_facts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "daily_facts_delete_admin" on public.daily_facts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5. Profiles: admin needs to SEE and UPDATE everyone's row (for User
--    Management — viewing all users and changing roles). Previously a
--    user could only see/update their own profile.
drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_admin_all" on public.profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "profiles_update_admin_all" on public.profiles;
create policy "profiles_update_admin_all" on public.profiles for update
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================
-- Make yourself admin (if not already) — run separately, replace email:
-- update public.profiles set role = 'admin' where email = 'your-email@gmail.com';
-- ============================================================
-- ============================================================
-- Migration: Live Exam Subscription (paid Live Exams only,
-- everything else stays free) — manual bKash/Nagad payment flow.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. Contact number on profile (captured at first payment submission,
--    shown persistently in User Management)
alter table public.profiles add column if not exists contact_number text;

-- 2. Per-Live-Exam admin toggle: is this exam free for everyone
--    regardless of subscription?
alter table public.live_exams add column if not exists free_for_all boolean default false;

-- 3. Payment settings (single row) — bKash/Nagad numbers, admin-editable
create table if not exists public.payment_settings (
  id int primary key default 1,
  bkash_number text,
  nagad_number text,
  instructions text,
  updated_at timestamptz default now(),
  constraint payment_settings_singleton check (id = 1)
);
insert into public.payment_settings (id) values (1) on conflict (id) do nothing;

alter table public.payment_settings enable row level security;
drop policy if exists "payment_settings_read" on public.payment_settings;
create policy "payment_settings_read" on public.payment_settings for select using (auth.role() = 'authenticated');
drop policy if exists "payment_settings_write_admin" on public.payment_settings;
create policy "payment_settings_write_admin" on public.payment_settings for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 4. Subscriptions (packages, submissions, approval)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  package text not null check (package in ('1m', '3m', '6m', '12m')),
  amount numeric not null,
  transaction_id text not null,
  contact_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.subscriptions enable row level security;

-- user can see/insert their own submissions
drop policy if exists "subscriptions_own_select" on public.subscriptions;
create policy "subscriptions_own_select" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "subscriptions_own_insert" on public.subscriptions;
create policy "subscriptions_own_insert" on public.subscriptions for insert with check (auth.uid() = user_id);

-- admin can see and update (approve/reject) everyone's
drop policy if exists "subscriptions_admin_select" on public.subscriptions;
create policy "subscriptions_admin_select" on public.subscriptions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update" on public.subscriptions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5. Enforce premium access at the database level: a 'live' session can
--    only be created if the live exam is marked free_for_all, OR the
--    user has an approved, unexpired subscription. This runs regardless
--    of what the frontend does, so it can't be bypassed by editing
--    client-side code.
create or replace function public.check_live_exam_access()
returns trigger as $$
declare
  is_free boolean;
  has_premium boolean;
begin
  if new.mode = 'live' and new.live_exam_id is not null then
    select free_for_all into is_free from public.live_exams where id = new.live_exam_id;
    if not coalesce(is_free, false) then
      select exists(
        select 1 from public.subscriptions
        where user_id = new.user_id and status = 'approved' and expires_at > now()
      ) into has_premium;
      if not has_premium then
        raise exception 'PREMIUM_REQUIRED: এই লাইভ পরীক্ষায় অংশ নিতে সাবস্ক্রিপশন লাগবে।';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_live_exam_access on public.practice_sessions;
create trigger enforce_live_exam_access
  before insert on public.practice_sessions
  for each row execute procedure public.check_live_exam_access();
-- ============================================================
-- Migration: Practice restructure — Flashcard/Direct MCQ practice
-- with "জানতাম/জানতাম না" tracking, fixed Live Exam question sets
-- with subject-wise composition, Exam Archive sourced from archived
-- Live Exams, and Quiz Builder becoming MCQ-only/exam-style.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

-- 1. "জানতাম/জানতাম না" tracking (replaces the old ⭐ favorites concept —
--    the ★ button now marks a question as "didn't know" too, same table).
create table if not exists public.question_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  status text not null check (status in ('known', 'unknown')),
  updated_at timestamptz default now(),
  unique (user_id, question_id)
);

alter table public.question_knowledge enable row level security;
drop policy if exists "question_knowledge_own" on public.question_knowledge;
create policy "question_knowledge_own" on public.question_knowledge for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Allow a generic 'practice' session mode (flashcard/direct-mcq
--    practice — no score is recorded for these, only time).
alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live', 'practice'));

-- 3. Live Exam: fixed question set (chosen once, same for everyone) +
--    optional subject/chapter weighted composition + archive flag.
alter table public.live_exams add column if not exists question_ids uuid[];
alter table public.live_exams add column if not exists composition jsonb;
alter table public.live_exams add column if not exists archived boolean default false;

-- 4. Quiz Builder is now MCQ-only by design (enforced in the app, not
--    the DB, since short-answer questions must remain valid data for
--    Practice). No schema change needed for that — noted here for context.
-- ============================================================
-- Addendum to practice_restructure_migration.sql:
-- - Adds 'examarchive' as a distinct session mode (so replaying an
--   archived exam doesn't get counted in the original live event's
--   ranking).
-- - Updates the leaderboard function to only count actual 'live'
--   attempts, not later archive practice.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

alter table public.practice_sessions drop constraint if exists practice_sessions_mode_check;
alter table public.practice_sessions add constraint practice_sessions_mode_check
  check (mode in ('all', 'subject', 'topic', 'exam', 'custom', 'live', 'practice', 'examarchive'));

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
    and ps.mode = 'live'
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
