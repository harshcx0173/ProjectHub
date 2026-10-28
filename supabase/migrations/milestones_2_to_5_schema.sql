-- ==============================================================================
-- Migration: milestones_2_to_5_schema.sql
-- Description: Complete schema for Milestones 2, 3, 4, and 5:
--              - Projects, Groups, Members, Preferences, Admin Icon Protection
--              - Tasks, Statuses, Auto-Key (PRJ-101), Assignees, Checklists, Comments, Activity
--              - Project Channels, Messages, Threads, Icon Reactions, Files, Storage Bucket
--              - Notifications, User Sessions, Session Revocation, Enhanced Global Search
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Project Groups Table
-- ------------------------------------------------------------------------------
create table if not exists public.project_groups (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    position integer default 0 not null,
    created_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 2. Projects Table
-- ------------------------------------------------------------------------------
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    key text not null unique,
    description text,
    icon_type text not null check (icon_type in ('lucide', 'upload')) default 'lucide',
    icon_value text not null default 'Folder',
    color text not null default '#2563EB',
    group_id uuid references public.project_groups(id) on delete set null,
    is_archived boolean default false not null,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index if not exists idx_projects_key on public.projects(key);
create index if not exists idx_projects_group on public.projects(group_id);
create index if not exists idx_projects_archived on public.projects(is_archived);

-- ------------------------------------------------------------------------------
-- 3. Project Members Table
-- ------------------------------------------------------------------------------
create table if not exists public.project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_role text not null references public.roles(name) default 'Member',
    added_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null,
    unique(project_id, user_id)
);

create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_project_members_project on public.project_members(project_id);

-- ------------------------------------------------------------------------------
-- 4. User Project Preferences (Pinned, Recent per user)
-- ------------------------------------------------------------------------------
create table if not exists public.user_project_prefs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    is_pinned boolean default false not null,
    last_opened_at timestamptz,
    is_muted boolean default false not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    unique(user_id, project_id)
);

create index if not exists idx_user_prefs_user_pinned on public.user_project_prefs(user_id, is_pinned);
create index if not exists idx_user_prefs_user_recent on public.user_project_prefs(user_id, last_opened_at desc);

-- ------------------------------------------------------------------------------
-- 5. Helper Function: Can User View Project
-- ------------------------------------------------------------------------------
create or replace function public.can_view_project(p_user_id uuid, p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select (
        public.is_admin(p_user_id)
        or exists (
            select 1 from public.project_members
            where project_id = p_project_id and user_id = p_user_id
        )
    );
$$;

-- ------------------------------------------------------------------------------
-- 6. Admin Field Protection Trigger on Projects
-- ------------------------------------------------------------------------------
create or replace function public.check_project_admin_field_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin(auth.uid()) then
        if NEW.icon_type != OLD.icon_type or NEW.icon_value != OLD.icon_value then
            raise exception 'Permission denied: Only Administrators can edit project icons.';
        end if;
        if NEW.color != OLD.color then
            raise exception 'Permission denied: Only Administrators can edit project colors.';
        end if;
        if NEW.is_archived != OLD.is_archived then
            raise exception 'Permission denied: Only Administrators can archive or unarchive projects.';
        end if;
    end if;
    return NEW;
end;
$$;

drop trigger if exists tr_project_admin_field_protection on public.projects;
create trigger tr_project_admin_field_protection
before update on public.projects
for each row
execute function public.check_project_admin_field_protection();

-- ------------------------------------------------------------------------------
-- 7. Task Statuses Table (Columns per project)
-- ------------------------------------------------------------------------------
create table if not exists public.task_statuses (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    color text not null default '#64748B',
    position integer not null default 0,
    is_completed boolean default false not null,
    created_at timestamptz default now() not null,
    unique(project_id, name)
);

create index if not exists idx_task_statuses_project on public.task_statuses(project_id, position);

-- Auto-Seed Default Status Columns for New Projects
create or replace function public.seed_default_project_statuses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.task_statuses (project_id, name, color, position, is_completed)
    values
        (NEW.id, 'To Do', '#64748B', 0, false),
        (NEW.id, 'In Progress', '#2563EB', 1, false),
        (NEW.id, 'In Review', '#D97706', 2, false),
        (NEW.id, 'Done', '#16A34A', 3, true)
    on conflict do nothing;

    return NEW;
end;
$$;

drop trigger if exists tr_seed_default_project_statuses on public.projects;
create trigger tr_seed_default_project_statuses
after insert on public.projects
for each row
execute function public.seed_default_project_statuses();

-- ------------------------------------------------------------------------------
-- 8. Tasks Table
-- ------------------------------------------------------------------------------
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    status_id uuid not null references public.task_statuses(id) on delete restrict,
    task_number integer not null,
    task_key text not null,
    title text not null,
    description text,
    priority text not null check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
    due_date date,
    position integer not null default 0,
    creator_id uuid references public.profiles(id) on delete set null,
    is_deleted boolean default false not null,
    deleted_at timestamptz,
    version integer default 1 not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    unique(project_id, task_number)
);

create index if not exists idx_tasks_project_status on public.tasks(project_id, status_id, position);
create index if not exists idx_tasks_key on public.tasks(task_key);
create index if not exists idx_tasks_deleted on public.tasks(is_deleted);
create index if not exists idx_tasks_creator on public.tasks(creator_id);

-- Auto-Incrementing Task Number and Task Key Generator
create or replace function public.generate_task_number_and_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_key text;
    v_next_number integer;
begin
    select key into v_project_key from public.projects where id = NEW.project_id;
    if v_project_key is null then
        raise exception 'Project not found for task.';
    end if;

    select coalesce(max(task_number), 0) + 1 into v_next_number
    from public.tasks
    where project_id = NEW.project_id;

    NEW.task_number := v_next_number;
    NEW.task_key := v_project_key || '-' || v_next_number::text;

    return NEW;
end;
$$;

drop trigger if exists tr_generate_task_number_and_key on public.tasks;
create trigger tr_generate_task_number_and_key
before insert on public.tasks
for each row
execute function public.generate_task_number_and_key();

-- ------------------------------------------------------------------------------
-- 9. Task Sub-entities: Assignees, Checklist, Comments, Activity
-- ------------------------------------------------------------------------------
create table if not exists public.task_assignees (
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now() not null,
    primary key(task_id, user_id)
);
create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

create table if not exists public.task_checklist_items (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    title text not null,
    is_completed boolean default false not null,
    position integer default 0 not null,
    created_at timestamptz default now() not null
);
create index if not exists idx_checklist_task on public.task_checklist_items(task_id, position);

create table if not exists public.task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);
create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at);

create table if not exists public.task_activity (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete set null,
    action text not null,
    details jsonb default '{}'::jsonb not null,
    created_at timestamptz default now() not null
);
create index if not exists idx_task_activity_task on public.task_activity(task_id, created_at desc);

-- ------------------------------------------------------------------------------
-- 10. Project Channels & Chat Messages
-- ------------------------------------------------------------------------------
create table if not exists public.project_channels (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    description text,
    is_default boolean default false not null,
    created_at timestamptz default now() not null,
    unique(project_id, name)
);
create index if not exists idx_channels_project on public.project_channels(project_id);

create or replace function public.seed_default_project_channel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_channels (project_id, name, description, is_default)
    values (NEW.id, 'general', 'Default project discussion channel', true)
    on conflict do nothing;

    return NEW;
end;
$$;

drop trigger if exists tr_seed_default_project_channel on public.projects;
create trigger tr_seed_default_project_channel
after insert on public.projects
for each row
execute function public.seed_default_project_channel();

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    channel_id uuid not null references public.project_channels(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete set null,
    parent_id uuid references public.messages(id) on delete cascade,
    content text not null,
    is_pinned boolean default false not null,
    is_edited boolean default false not null,
    is_deleted boolean default false not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index if not exists idx_messages_channel on public.messages(channel_id, created_at desc);
create index if not exists idx_messages_thread on public.messages(parent_id) where parent_id is not null;
create index if not exists idx_messages_project on public.messages(project_id);

create table if not exists public.message_reactions (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.messages(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    icon_name text not null check (icon_name in ('thumbs-up', 'check', 'heart', 'flag', 'eye')),
    created_at timestamptz default now() not null,
    unique(message_id, user_id, icon_name)
);
create index if not exists idx_message_reactions_msg on public.message_reactions(message_id);

-- ------------------------------------------------------------------------------
-- 11. Files Table
-- ------------------------------------------------------------------------------
create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete set null,
    message_id uuid references public.messages(id) on delete set null,
    uploader_id uuid references public.profiles(id) on delete set null,
    file_name text not null,
    storage_path text not null unique,
    storage_provider text not null default 'supabase',
    content_type text not null,
    size_bytes bigint not null,
    category text not null check (category in ('image', 'audio', 'recording', 'document')),
    is_deleted boolean default false not null,
    deleted_at timestamptz,
    created_at timestamptz default now() not null
);
create index if not exists idx_files_project on public.files(project_id, category, created_at desc);
create index if not exists idx_files_task on public.files(task_id) where task_id is not null;
create index if not exists idx_files_message on public.files(message_id) where message_id is not null;

-- ------------------------------------------------------------------------------
-- 12. Notifications & User Sessions Tables
-- ------------------------------------------------------------------------------
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

create or replace function public.revoke_all_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() != p_user_id and not public.is_admin(auth.uid()) then
        raise exception 'Permission denied: Cannot revoke sessions for another user.';
    end if;

    update public.user_sessions
    set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;
end;
$$;

-- ------------------------------------------------------------------------------
-- 13. Enable RLS on All Tables
-- ------------------------------------------------------------------------------
alter table public.project_groups enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.user_project_prefs enable row level security;
alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.project_channels enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;
alter table public.user_sessions enable row level security;

-- ------------------------------------------------------------------------------
-- 14. Row Level Security Policies
-- ------------------------------------------------------------------------------
-- Project Groups
drop policy if exists "Authenticated users can view project groups" on public.project_groups;
create policy "Authenticated users can view project groups"
on public.project_groups for select
using (auth.role() = 'authenticated');

drop policy if exists "Users with project.create can create project groups" on public.project_groups;
create policy "Users with project.create can create project groups"
on public.project_groups for insert
with check (public.has_permission(auth.uid(), 'project.create'));

drop policy if exists "Admins can update and delete project groups" on public.project_groups;
create policy "Admins can update and delete project groups"
on public.project_groups for all
using (public.is_admin(auth.uid()));

-- Projects
drop policy if exists "Users can view authorized projects" on public.projects;
create policy "Users can view authorized projects"
on public.projects for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = id and pm.user_id = auth.uid()
    )
);

drop policy if exists "Users with project.create can insert projects" on public.projects;
create policy "Users with project.create can insert projects"
on public.projects for insert
with check (public.has_permission(auth.uid(), 'project.create'));

drop policy if exists "Authorized users can update projects" on public.projects;
create policy "Authorized users can update projects"
on public.projects for update
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
)
with check (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects"
on public.projects for delete
using (public.is_admin(auth.uid()));

-- Project Members
drop policy if exists "Users can view members of accessible projects" on public.project_members;
create policy "Users can view members of accessible projects"
on public.project_members for select
using (public.can_view_project(auth.uid(), project_id));

drop policy if exists "Managers and Admins can insert project members" on public.project_members;
create policy "Managers and Admins can insert project members"
on public.project_members for insert
with check (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = project_id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

drop policy if exists "Managers and Admins can delete project members" on public.project_members;
create policy "Managers and Admins can delete project members"
on public.project_members for delete
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = project_id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

-- User Preferences
drop policy if exists "Users can manage their own project preferences" on public.user_project_prefs;
create policy "Users can manage their own project preferences"
on public.user_project_prefs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Task Statuses
drop policy if exists "Users can view statuses of accessible projects" on public.task_statuses;
create policy "Users can view statuses of accessible projects"
on public.task_statuses for select
using (public.can_view_project(auth.uid(), project_id));

drop policy if exists "Admins and Managers can manage task statuses" on public.task_statuses;
create policy "Admins and Managers can manage task statuses"
on public.task_statuses for all
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = project_id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

-- Tasks
drop policy if exists "Users can view non-deleted tasks of accessible projects" on public.tasks;
create policy "Users can view non-deleted tasks of accessible projects"
on public.tasks for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

drop policy if exists "Users with task.create can insert tasks" on public.tasks;
create policy "Users with task.create can insert tasks"
on public.tasks for insert
with check (
    public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'task.create')
);

drop policy if exists "Users with task.edit can update tasks" on public.tasks;
create policy "Users with task.edit can update tasks"
on public.tasks for update
using (
    public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'task.edit')
)
with check (
    public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'task.edit')
);

drop policy if exists "Users with task.delete can delete tasks" on public.tasks;
create policy "Users with task.delete can delete tasks"
on public.tasks for delete
using (
    public.is_admin(auth.uid())
    or (creator_id = auth.uid() and public.has_permission(auth.uid(), 'task.delete_own'))
    or public.has_permission(auth.uid(), 'task.delete')
);

-- Task Assignees
drop policy if exists "Users can view task assignees" on public.task_assignees;
create policy "Users can view task assignees"
on public.task_assignees for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

drop policy if exists "Users with task.edit can manage task assignees" on public.task_assignees;
create policy "Users with task.edit can manage task assignees"
on public.task_assignees for all
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.has_permission(auth.uid(), 'task.assign')
    )
);

-- Checklist Items
drop policy if exists "Users can view checklist items" on public.task_checklist_items;
create policy "Users can view checklist items"
on public.task_checklist_items for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

drop policy if exists "Users with task.edit can manage checklist items" on public.task_checklist_items;
create policy "Users with task.edit can manage checklist items"
on public.task_checklist_items for all
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.has_permission(auth.uid(), 'task.edit')
    )
);

-- Task Comments
drop policy if exists "Users can view task comments" on public.task_comments;
create policy "Users can view task comments"
on public.task_comments for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

drop policy if exists "Users can add comments to accessible tasks" on public.task_comments;
create policy "Users can add comments to accessible tasks"
on public.task_comments for insert
with check (
    author_id = auth.uid()
    and exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

drop policy if exists "Authors can edit their own comments" on public.task_comments;
create policy "Authors can edit their own comments"
on public.task_comments for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- Task Activity
drop policy if exists "Users can view task activity" on public.task_activity;
create policy "Users can view task activity"
on public.task_activity for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

drop policy if exists "System can record task activity" on public.task_activity;
create policy "System can record task activity"
on public.task_activity for insert
with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Channels
drop policy if exists "Users can view channels of accessible projects" on public.project_channels;
create policy "Users can view channels of accessible projects"
on public.project_channels for select
using (public.can_view_project(auth.uid(), project_id));

drop policy if exists "Admins and Managers can manage channels" on public.project_channels;
create policy "Admins and Managers can manage channels"
on public.project_channels for all
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = project_id and pm.user_id = auth.uid()
          and pm.project_role in ('Admin', 'Manager')
    )
);

-- Messages
drop policy if exists "Users can view messages of accessible projects" on public.messages;
create policy "Users can view messages of accessible projects"
on public.messages for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

drop policy if exists "Users with chat.post can send messages" on public.messages;
create policy "Users with chat.post can send messages"
on public.messages for insert
with check (
    user_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'chat.post')
);

drop policy if exists "Users can update their own messages" on public.messages;
create policy "Users can update their own messages"
on public.messages for update
using (
    user_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'chat.post')
)
with check (
    user_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
);

drop policy if exists "Users can delete their own message or admins can moderate" on public.messages;
create policy "Users can delete their own message or admins can moderate"
on public.messages for delete
using (
    (user_id = auth.uid() and public.has_permission(auth.uid(), 'chat.delete_own'))
    or public.is_admin(auth.uid())
    or public.has_permission(auth.uid(), 'chat.moderate')
);

-- Reactions
drop policy if exists "Users can view reactions on accessible messages" on public.message_reactions;
create policy "Users can view reactions on accessible messages"
on public.message_reactions for select
using (
    exists (
        select 1 from public.messages m
        where m.id = message_id and public.can_view_project(auth.uid(), m.project_id)
    )
);

drop policy if exists "Users with chat.post can add reactions" on public.message_reactions;
create policy "Users with chat.post can add reactions"
on public.message_reactions for insert
with check (
    user_id = auth.uid()
    and exists (
        select 1 from public.messages m
        where m.id = message_id and public.can_view_project(auth.uid(), m.project_id)
    )
    and public.has_permission(auth.uid(), 'chat.post')
);

drop policy if exists "Users can remove their own reactions" on public.message_reactions;
create policy "Users can remove their own reactions"
on public.message_reactions for delete
using (user_id = auth.uid());

-- Files
drop policy if exists "Users can view files in accessible projects" on public.files;
create policy "Users can view files in accessible projects"
on public.files for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

drop policy if exists "Users with file.upload can insert files" on public.files;
create policy "Users with file.upload can insert files"
on public.files for insert
with check (
    uploader_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'file.upload')
);

drop policy if exists "Users can delete own files or managers/admins can delete" on public.files;
create policy "Users can delete own files or managers/admins can delete"
on public.files for delete
using (
    (uploader_id = auth.uid() and public.has_permission(auth.uid(), 'file.delete_own'))
    or public.is_admin(auth.uid())
    or public.has_permission(auth.uid(), 'file.delete')
);

-- Notifications
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists "Users can update their own notification read status" on public.notifications;
create policy "Users can update their own notification read status"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "System can create notifications" on public.notifications;
create policy "System can create notifications"
on public.notifications for insert
with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Sessions
drop policy if exists "Users can view their own active sessions" on public.user_sessions;
create policy "Users can view their own active sessions"
on public.user_sessions for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "Users can insert their own session" on public.user_sessions;
create policy "Users can insert their own session"
on public.user_sessions for insert
with check (user_id = auth.uid() or auth.role() = 'service_role');

drop policy if exists "Users can update or revoke their own session" on public.user_sessions;
create policy "Users can update or revoke their own session"
on public.user_sessions for update
using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 15. Enhanced Global Search Function
-- Searches projects, tasks, files, and users with full permission check
-- ------------------------------------------------------------------------------
create or replace function public.global_search(p_query text)
returns table (
    result_type text,
    id uuid,
    title text,
    subtitle text,
    project_id uuid,
    project_name text,
    url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
begin
    -- 1. Search Projects
    return query
    select 
        'project'::text as result_type,
        p.id,
        p.name as title,
        coalesce(p.description, p.key) as subtitle,
        p.id as project_id,
        p.name as project_name,
        ('/projects/' || p.id::text || '/board')::text as url
    from public.projects p
    where public.can_view_project(v_user_id, p.id)
      and (
          p.name ilike ('%' || p_query || '%')
          or p.key ilike ('%' || p_query || '%')
          or p.description ilike ('%' || p_query || '%')
      )
    limit 5;

    -- 2. Search Tasks
    return query
    select
        'task'::text as result_type,
        t.id,
        (t.task_key || ': ' || t.title) as title,
        coalesce(t.description, 'Priority: ' || t.priority) as subtitle,
        t.project_id,
        p.name as project_name,
        ('/projects/' || t.project_id::text || '/board?task=' || t.id::text)::text as url
    from public.tasks t
    join public.projects p on p.id = t.project_id
    where not t.is_deleted
      and public.can_view_project(v_user_id, t.project_id)
      and (
          t.title ilike ('%' || p_query || '%')
          or t.task_key ilike ('%' || p_query || '%')
          or t.description ilike ('%' || p_query || '%')
      )
    limit 10;

    -- 3. Search Files
    return query
    select
        'file'::text as result_type,
        f.id,
        f.file_name as title,
        ('Size: ' || (f.size_bytes / 1024)::text || ' KB - ' || f.category) as subtitle,
        f.project_id,
        p.name as project_name,
        ('/projects/' || f.project_id::text || '/files')::text as url
    from public.files f
    join public.projects p on p.id = f.project_id
    where not f.is_deleted
      and public.can_view_project(v_user_id, f.project_id)
      and f.file_name ilike ('%' || p_query || '%')
    limit 5;

    -- 4. Search People
    if public.is_active_member(v_user_id) then
        return query
        select 
            'person'::text as result_type,
            prof.id,
            prof.full_name as title,
            coalesce(prof.designation, prof.org_role) as subtitle,
            null::uuid as project_id,
            null::text as project_name,
            ('/admin/users?search=' || prof.full_name)::text as url
        from public.profiles prof
        where prof.status = 'active'
          and (
              prof.full_name ilike ('%' || p_query || '%')
              or prof.designation ilike ('%' || p_query || '%')
          )
        limit 5;
    end if;

    return;
end;
$$;

-- ------------------------------------------------------------------------------
-- 16. Supabase Storage Bucket Configuration
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'project-files',
    'project-files',
    false,
    52428800,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
        'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
        'video/mp4', 'video/webm'
    ]
)
on conflict (id) do update set
    public = false,
    file_size_limit = 52428800;

-- ------------------------------------------------------------------------------
-- 17. Realtime Replication Publications
-- ------------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'message_reactions'
    ) then
        alter publication supabase_realtime add table public.message_reactions;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'notifications'
    ) then
        alter publication supabase_realtime add table public.notifications;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'tasks'
    ) then
        alter publication supabase_realtime add table public.tasks;
    end if;
end;
$$;
