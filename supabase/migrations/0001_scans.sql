-- Patra Lens cloud data: every scan a user takes, with its photo, and an admin who can see all of them.
-- Scans are written only by the analyze-leaf edge function (service role), so the public key cannot write or read them.
-- Admins are Supabase Auth users whose app_metadata.role is "admin" (set by scripts/setup-supabase.mjs).

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  user_name text,
  phone text,
  village text,
  lat double precision,
  lon double precision,
  photo_path text not null,
  source text not null check (source in ('ai-vision', 'on-device')),
  is_plant boolean,
  plant text,
  is_tomato boolean,
  disease text,
  severity text,
  confidence real,
  detections jsonb not null default '[]'::jsonb,
  care_plan jsonb,
  result jsonb not null,
  feedback text check (feedback in ('right', 'wrong')),
  admin_note text
);

create index if not exists scans_created_at_idx on public.scans (created_at desc);
create index if not exists scans_device_idx on public.scans (device_id);

alter table public.scans enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

drop policy if exists "admins read scans" on public.scans;
create policy "admins read scans" on public.scans for select to authenticated using (public.is_admin());
drop policy if exists "admins update scans" on public.scans;
create policy "admins update scans" on public.scans for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete scans" on public.scans;
create policy "admins delete scans" on public.scans for delete to authenticated using (public.is_admin());

-- Photos: private bucket. The edge function uploads; admins read through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scan-photos', 'scan-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "admins read scan photos" on storage.objects;
create policy "admins read scan photos" on storage.objects for select to authenticated
  using (bucket_id = 'scan-photos' and public.is_admin());
drop policy if exists "admins delete scan photos" on storage.objects;
create policy "admins delete scan photos" on storage.objects for delete to authenticated
  using (bucket_id = 'scan-photos' and public.is_admin());
