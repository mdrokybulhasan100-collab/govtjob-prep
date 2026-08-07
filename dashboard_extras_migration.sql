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
