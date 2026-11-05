-- Lab staff and scientists who sign in with their email (one-time code or link) to review farmers' scans.
-- A new expert can only create their own row, unapproved. An admin approves them on /admin; only approved
-- experts can read scans, photos and lab requests, and reply to lab requests.
create table if not exists public.experts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  email text not null,
  name text,
  phone text,
  organisation text,
  approved boolean not null default false
);

alter table public.experts enable row level security;

drop policy if exists "experts create own row" on public.experts;
create policy "experts create own row" on public.experts for insert to authenticated
  with check (user_id = auth.uid() and approved = false);
drop policy if exists "experts read own row" on public.experts;
create policy "experts read own row" on public.experts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admins update experts" on public.experts;
create policy "admins update experts" on public.experts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete experts" on public.experts;
create policy "admins delete experts" on public.experts for delete to authenticated using (public.is_admin());

create or replace function public.is_expert() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.experts where user_id = auth.uid() and approved);
$$;

drop policy if exists "experts read scans" on public.scans;
create policy "experts read scans" on public.scans for select to authenticated using (public.is_expert());
drop policy if exists "experts read escalations" on public.escalations;
create policy "experts read escalations" on public.escalations for select to authenticated using (public.is_expert());
drop policy if exists "experts update escalations" on public.escalations;
create policy "experts update escalations" on public.escalations for update to authenticated
  using (public.is_expert()) with check (public.is_expert());
drop policy if exists "experts read scan photos" on storage.objects;
create policy "experts read scan photos" on storage.objects for select to authenticated
  using (bucket_id = 'scan-photos' and public.is_expert());

-- Table access for signed-in users; the row-level policies above still decide which rows each person sees.
grant select, insert, update, delete on public.experts to authenticated;
grant select, update, delete on public.scans to authenticated;
grant select, update, delete on public.escalations to authenticated;
grant select, delete on public.agent_chats to authenticated;
grant execute on function public.is_expert() to authenticated;
