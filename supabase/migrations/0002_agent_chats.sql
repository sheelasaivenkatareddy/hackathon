-- Questions farmers ask the side-panel assistant, and its answers. Written by the ask-agent function; read by admins.
create table if not exists public.agent_chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  user_name text,
  lang text,
  question text not null,
  answer text not null
);

create index if not exists agent_chats_created_at_idx on public.agent_chats (created_at desc);
create index if not exists agent_chats_device_idx on public.agent_chats (device_id, created_at desc);

alter table public.agent_chats enable row level security;

drop policy if exists "admins read chats" on public.agent_chats;
create policy "admins read chats" on public.agent_chats for select to authenticated using (public.is_admin());
drop policy if exists "admins delete chats" on public.agent_chats;
create policy "admins delete chats" on public.agent_chats for delete to authenticated using (public.is_admin());
