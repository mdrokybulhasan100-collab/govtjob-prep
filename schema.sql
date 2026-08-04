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

-- 3. TOPICS
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
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
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('a','b','c','d')),
  explanation text,
  difficulty text default 'medium' check (difficulty in ('easy','medium','hard'))
);

-- 6. PRACTICE SESSIONS (private — one row per quiz attempt, owned by one user)
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('all','subject','topic','exam')),
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

insert into public.questions (subject_id, topic_id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
select s.id, t.id, e.id,
  '"সমাস" শব্দটির আভিধানিক অর্থ কী?',
  'বিস্তার', 'সংক্ষেপণ', 'বিভাজন', 'সংযোজন',
  'b', 'সমাস শব্দের আভিধানিক অর্থ সংক্ষেপণ — একাধিক পদকে একপদে পরিণত করা।', 'easy'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Grammar' and s.slug = 'bangla'
left join public.exams e on e.slug = 'bcs-43-preli'
where s.slug = 'bangla' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
select s.id, t.id, null,
  'Choose the correct synonym of "Ubiquitous":',
  'Rare', 'Omnipresent', 'Hidden', 'Ancient',
  'b', '"Ubiquitous" means present everywhere, so the closest synonym is "Omnipresent".', 'medium'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Vocabulary' and s.slug = 'english'
where s.slug = 'english' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
select s.id, t.id, null,
  'একটি সংখ্যার ২৫% যদি ৫০ হয়, তবে সংখ্যাটি কত?',
  '১৫০', '২০০', '২৫০', '৩০০',
  'b', '৫০ ÷ ২৫ × ১০০ = ২০০', 'easy'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Arithmetic' and s.slug = 'math'
where s.slug = 'math' limit 1;

insert into public.questions (subject_id, topic_id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty)
select s.id, t.id, e.id,
  'বাংলাদেশের সংবিধান কার্যকর হয় কবে?',
  '১৬ ডিসেম্বর ১৯৭২', '৪ নভেম্বর ১৯৭২', '২৬ মার্চ ১৯৭২', '১ জানুয়ারি ১৯৭৩',
  'a', 'বাংলাদেশের সংবিধান ৪ নভেম্বর ১৯৭২ গৃহীত হয় এবং ১৬ ডিসেম্বর ১৯৭২ থেকে কার্যকর হয়।', 'medium'
from public.subjects s
join public.topics t on t.subject_id = s.id and t.name_en = 'Bangladesh Affairs' and s.slug = 'gk'
left join public.exams e on e.slug = 'bcs-42-preli'
where s.slug = 'gk' limit 1;
