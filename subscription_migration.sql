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
