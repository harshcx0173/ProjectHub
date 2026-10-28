-- ==============================================================================
-- Migration: 20261028000006_notifications_and_sessions.sql
-- Description: In-app notifications, user session tracking, session revocation,
--              and Realtime notification stream.
-- ==============================================================================

-- 1. In-App Notifications Table
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete set null,
    type text not null check (type in ('task_assigned', 'task_comment', 'mention', 'project_invite', 'system')),
    title text not null,
    body text not null,
    link_url text,
    is_read boolean default false not null,
    metadata jsonb default '{}'::jsonb not null,
    created_at timestamptz default now() not null
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- 2. User Active Sessions Table (For session list & remote revocation)
create table if not exists public.user_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    session_token_hash text not null unique,
    ip_address text,
    user_agent text,
    last_active_at timestamptz default now() not null,
    revoked_at timestamptz,
    created_at timestamptz default now() not null
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_id, revoked_at);

-- 3. Session Revocation RPC
create or replace function public.revoke_all_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Only admin or the user themselves can revoke sessions
    if auth.uid() != p_user_id and not public.is_admin(auth.uid()) then
        raise exception 'Permission denied: Cannot revoke sessions for another user.';
    end if;

    update public.user_sessions
    set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Row Level Security Policies
-- ------------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.user_sessions enable row level security;

-- Notifications
create policy "Users can view their own notifications"
on public.notifications for select
using (user_id = auth.uid());

create policy "Users can update their own notification read status"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "System can create notifications"
on public.notifications for insert
with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Sessions
create policy "Users can view their own active sessions"
on public.user_sessions for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can insert their own session"
on public.user_sessions for insert
with check (user_id = auth.uid() or auth.role() = 'service_role');

create policy "Users can update or revoke their own session"
on public.user_sessions for update
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. Realtime Notification Replication
-- ------------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;
end;
$$;
