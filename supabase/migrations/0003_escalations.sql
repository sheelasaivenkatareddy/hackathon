-- Scans a farmer forwards to a lab, KVK, RBK/RSK or officer from Kisan Hub. Written by the kisan-hub function;
-- admins (and lab staff given the admin role) read them and set the status and a reply.
create table if not exists public.escalations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  scan_id uuid references public.scans(id) on delete set null,
  user_name text,
  phone text,
  village text,
  lab_id text not null,
  lab_name text not null,
  crop text,
  disease text,
  note text,
  summary jsonb,
  status text not null default 'new' check (status in ('new', 'in_review', 'resolved')),
  lab_reply text
);

create index if not exists escalations_created_at_idx on public.escalations (created_at desc);
create index if not exists escalations_device_idx on public.escalations (device_id, created_at desc);

alter table public.escalations enable row level security;

drop policy if exists "admins read escalations" on public.escalations;
create policy "admins read escalations" on public.escalations for select to authenticated using (public.is_admin());
drop policy if exists "admins update escalations" on public.escalations;
create policy "admins update escalations" on public.escalations for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete escalations" on public.escalations;
create policy "admins delete escalations" on public.escalations for delete to authenticated using (public.is_admin());
