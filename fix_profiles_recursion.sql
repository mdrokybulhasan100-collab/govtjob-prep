-- ============================================================
-- Fix: infinite recursion in the profiles RLS policy.
-- The old policy checked "is this user an admin?" by querying
-- profiles from WITHIN a policy ON profiles — which re-triggers
-- the same policy forever. This uses a SECURITY DEFINER function
-- instead, which bypasses RLS internally and breaks the loop.
-- Paste into Supabase SQL Editor > New query > Run. Safe to re-run.
-- ============================================================

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin_user() to authenticated;

drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_admin_all" on public.profiles for select
  using (auth.uid() = id or public.is_admin_user());

drop policy if exists "profiles_update_admin_all" on public.profiles;
create policy "profiles_update_admin_all" on public.profiles for update
  using (auth.uid() = id or public.is_admin_user());
