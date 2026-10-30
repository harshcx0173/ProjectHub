-- Migration: 20261030000004_fix_project_membership_and_messaging.sql
-- Description: 
--   1. Fix project RLS policies to use fully qualified projects.id instead of shadowed id
--   2. Implement 1v1 Direct Messages and Teams-style Group Messaging schema and RLS

-- ==============================================================================
-- 1. Fix Project RLS Policies (Qualified projects.id)
-- ==============================================================================

drop policy if exists "Users can view authorized projects" on public.projects;
create policy "Users can view authorized projects"
on public.projects for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = projects.id and pm.user_id = auth.uid()
    )
);

drop policy if exists "Authorized users can update projects" on public.projects;
create policy "Authorized users can update projects"
on public.projects for update
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = projects.id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
)
with check (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = projects.id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

-- ==============================================================================
-- 2. Direct Messages & Teams-style Group Messaging Schema
-- ==============================================================================

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('direct', 'group')),
    name text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table if not exists public.conversation_members (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    joined_at timestamptz default now() not null,
    last_read_at timestamptz default now() not null,
    unique(conversation_id, user_id)
);

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id uuid references public.profiles(id) on delete set null,
    content text not null,
    is_deleted boolean default false not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists idx_conv_members_user on public.conversation_members(user_id, conversation_id);
create index if not exists idx_conv_messages_conv on public.conversation_messages(conversation_id, created_at asc);
create index if not exists idx_conv_updated on public.conversations(updated_at desc);

-- ==============================================================================
-- 3. Row Level Security for Messaging (Strict Member Isolation)
-- ==============================================================================

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.conversation_messages enable row level security;

-- Conversations RLS
drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations"
on public.conversations for select
using (
    exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
    )
);

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
on public.conversations for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Members can update conversation metadata" on public.conversations;
create policy "Members can update conversation metadata"
on public.conversations for update
using (
    exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
    )
);

-- Conversation Members RLS
drop policy if exists "Members can view conversation members" on public.conversation_members;
create policy "Members can view conversation members"
on public.conversation_members for select
using (
    user_id = auth.uid()
    or exists (
        select 1 from public.conversation_members cm2
        where cm2.conversation_id = conversation_members.conversation_id
          and cm2.user_id = auth.uid()
    )
);

drop policy if exists "Authenticated users can add members" on public.conversation_members;
create policy "Authenticated users can add members"
on public.conversation_members for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Users can update their own member state" on public.conversation_members;
create policy "Users can update their own member state"
on public.conversation_members for update
using (user_id = auth.uid());

-- Conversation Messages RLS
drop policy if exists "Members can view messages" on public.conversation_messages;
create policy "Members can view messages"
on public.conversation_messages for select
using (
    exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversation_messages.conversation_id
          and cm.user_id = auth.uid()
    )
);

drop policy if exists "Members can insert messages" on public.conversation_messages;
create policy "Members can insert messages"
on public.conversation_messages for insert
with check (
    sender_id = auth.uid()
    and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = conversation_messages.conversation_id
          and cm.user_id = auth.uid()
    )
);

drop policy if exists "Senders can edit their own messages" on public.conversation_messages;
create policy "Senders can edit their own messages"
on public.conversation_messages for update
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

