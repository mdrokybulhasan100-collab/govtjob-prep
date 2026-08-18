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
