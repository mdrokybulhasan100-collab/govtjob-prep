-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Run AFTER schema.sql + the existing feature migrations.
-- Safe to re-run.
--
-- Fixes:
--   1) Users cannot promote themselves / change protected profile fields.
--   2) Users cannot forge approved subscriptions or expiry dates.
--   3) Live exam access is enforced for subscription + time window.
--   4) A user gets only one live attempt per exam.
--   5) Live answers are scored server-side; client cannot set live score.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Protected profile fields
-- ------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin_user() then
    if new.role is distinct from old.role
       or new.is_admin is distinct from old.is_admin
       or new.editor_status is distinct from old.editor_status then
      raise exception 'FORBIDDEN: privileged profile fields can only be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute procedure public.protect_profile_privileges();

-- Replace the permissive self-update policy with one that still allows
-- normal profile edits (e.g. contact_number) but never grants privilege.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id or public.is_admin_user())
with check (auth.uid() = id or public.is_admin_user());

-- ------------------------------------------------------------
-- 2. Subscription tamper protection
-- ------------------------------------------------------------
create or replace function public.protect_subscription_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins are allowed to approve/reject and set dates.
  if public.is_admin_user() then
    return new;
  end if;

  -- A normal user can only create/maintain a pending submission.
  if new.user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN: subscription user mismatch';
  end if;

  new.status := 'pending';
  new.starts_at := null;
  new.expires_at := null;
  new.reviewed_at := null;
  new.reviewed_by := null;

  -- Keep amount authoritative instead of trusting browser-supplied price.
  new.amount := case new.package
    when '1m' then 20
    when '3m' then 50
    when '6m' then 100
    when '12m' then 150
    else null
  end;

  if new.amount is null then
    raise exception 'INVALID_PACKAGE';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_subscription_submission on public.subscriptions;
create trigger protect_subscription_submission
before insert or update on public.subscriptions
for each row execute procedure public.protect_subscription_submission();

-- ------------------------------------------------------------
-- 3. Live exam access + timing + one-attempt enforcement
-- ------------------------------------------------------------
create or replace function public.check_live_exam_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_free boolean;
  exam_start timestamptz;
  exam_end timestamptz;
  exam_question_count int;
  has_premium boolean;
begin
  if new.mode <> 'live' or new.live_exam_id is null then
    return new;
  end if;

  select free_for_all, start_at,
         start_at + (duration_minutes * interval '1 minute'),
         question_count
    into exam_free, exam_start, exam_end, exam_question_count
  from public.live_exams
  where id = new.live_exam_id;

  if exam_start is null then
    raise exception 'LIVE_EXAM_NOT_FOUND';
  end if;

  if now() < exam_start or now() >= exam_end then
    raise exception 'LIVE_EXAM_CLOSED: এই পরীক্ষার সময় এখন নয়।';
  end if;

  if not coalesce(exam_free, false) then
    select exists(
      select 1 from public.subscriptions
      where user_id = new.user_id
        and status = 'approved'
        and expires_at > now()
    ) into has_premium;

    if not has_premium then
      raise exception 'PREMIUM_REQUIRED: এই লাইভ পরীক্ষায় অংশ নিতে সাবস্ক্রিপশন লাগবে।';
    end if;
  end if;

  -- The server decides the question count; never trust the browser.
  new.total_questions := coalesce(exam_question_count, 0);
  new.correct_answers := 0;

  if exists (
    select 1 from public.practice_sessions
    where user_id = new.user_id
      and mode = 'live'
      and live_exam_id = new.live_exam_id
  ) then
    raise exception 'ALREADY_ATTEMPTED: এই লাইভ পরীক্ষা আপনি ইতিমধ্যে শুরু করেছেন।';
  end if;

  return new;
end;
$$;

-- Keep the existing trigger name, but replace its function body above.
drop trigger if exists enforce_live_exam_access on public.practice_sessions;
create trigger enforce_live_exam_access
before insert on public.practice_sessions
for each row execute procedure public.check_live_exam_access();

-- ------------------------------------------------------------
-- 4. Live answer RPC: never returns correctness to the browser.
-- ------------------------------------------------------------
create or replace function public.submit_live_exam_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  session_user uuid;
  session_mode text;
  session_completed timestamptz;
  question_exists boolean;
begin
  select user_id, mode, completed_at
    into session_user, session_mode, session_completed
  from public.practice_sessions
  where id = p_session_id;

  if session_user is null or session_user <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if session_mode <> 'live' then
    raise exception 'INVALID_SESSION_MODE';
  end if;
  if session_completed is not null then
    raise exception 'SESSION_ALREADY_COMPLETED';
  end if;
  if p_selected_option not in ('a','b','c','d') then
    raise exception 'INVALID_OPTION';
  end if;

  select exists(
    select 1
    from public.live_exams le
    join public.practice_sessions ps on ps.live_exam_id = le.id
    where ps.id = p_session_id
      and p_question_id = any(le.question_ids)
  ) into question_exists;

  if not question_exists then
    raise exception 'QUESTION_NOT_IN_EXAM';
  end if;

  -- Deliberately store is_correct as NULL. The server calculates it only
  -- during finalization, so the client cannot inspect answer correctness.
  delete from public.session_answers
  where session_id = p_session_id and question_id = p_question_id;

  insert into public.session_answers(session_id, question_id, selected_option, is_correct)
  values (p_session_id, p_question_id, p_selected_option, null);
end;
$$;

grant execute on function public.submit_live_exam_answer(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 5. Live finalization: server computes score and locks the session.
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 6. Prevent client-side score forgery for live sessions.
-- The RPCs above use a transaction-local marker to authorize finalization.
-- ------------------------------------------------------------
create or replace function public.protect_live_session_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.mode = 'live' and not public.is_admin_user() then
    if new.user_id is distinct from old.user_id
       or new.mode is distinct from old.mode
       or new.live_exam_id is distinct from old.live_exam_id
       or new.total_questions is distinct from old.total_questions
       or new.correct_answers is distinct from old.correct_answers
       or (new.completed_at is distinct from old.completed_at
           and current_setting('app.live_finalize', true) <> '1') then
      raise exception 'FORBIDDEN: live exam score is server-controlled';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_live_session_score on public.practice_sessions;
create trigger protect_live_session_score
before update on public.practice_sessions
for each row execute procedure public.protect_live_session_score();

-- Recreate finalizer so its update is explicitly authorized by the trigger.
create or replace function public.finalize_live_exam(p_session_id uuid)
returns table(correct_answers int, total_questions int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_mode text;
  v_completed timestamptz;
  v_correct int;
  v_total int;
  v_now timestamptz := now();
begin
  select user_id, mode, completed_at, practice_sessions.total_questions
    into v_user_id, v_mode, v_completed, v_total
  from public.practice_sessions
  where id = p_session_id
  for update;

  if v_user_id is null or v_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if v_mode <> 'live' then raise exception 'INVALID_SESSION_MODE'; end if;
  if v_completed is not null then
    return query select (select ps.correct_answers from public.practice_sessions ps where ps.id = p_session_id), v_total;
    return;
  end if;

  select count(*)::int into v_correct
  from public.session_answers sa
  join public.questions q on q.id = sa.question_id
  join public.practice_sessions ps on ps.id = sa.session_id
  join public.live_exams le on le.id = ps.live_exam_id
  where sa.session_id = p_session_id
    and sa.selected_option is not null
    and sa.question_id = any(le.question_ids)
    and sa.selected_option = q.correct_option;

  perform set_config('app.live_finalize', '1', true);

  update public.session_answers sa
     set is_correct = (
       sa.selected_option is not null
       and sa.selected_option = q.correct_option
       and sa.question_id = any(le.question_ids)
     )
    from public.questions q
    join public.practice_sessions ps on ps.id = p_session_id
    join public.live_exams le on le.id = ps.live_exam_id
   where sa.session_id = p_session_id and sa.question_id = q.id;

  update public.practice_sessions
     set correct_answers = v_correct, completed_at = v_now
   where id = p_session_id;

  return query select v_correct, v_total;
end;
$$;

grant execute on function public.finalize_live_exam(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. Leaderboard: score only, no identity leakage.
-- ------------------------------------------------------------
create or replace function public.live_exam_leaderboard(p_live_exam_id uuid)
returns table(rank bigint, correct_answers int, total_questions int, is_me boolean)
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
    and ps.mode = 'live'
    and ps.completed_at is not null
  order by rank;
$$;

grant execute on function public.live_exam_leaderboard(uuid) to authenticated;
