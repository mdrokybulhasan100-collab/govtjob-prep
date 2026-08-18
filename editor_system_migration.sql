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
