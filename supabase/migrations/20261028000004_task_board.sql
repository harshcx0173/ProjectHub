-- ==============================================================================
-- Migration: 20261028000004_task_board.sql
-- Description: Task statuses, tasks, auto-key numbering (PRJ-101), assignees,
--              checklist items, comments, activity logs, and RLS policies.
-- ==============================================================================

-- 1. Task Statuses Table (Columns per project)
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

-- 2. Tasks Table
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

-- 3. Auto-Incrementing Task Number and Task Key Generator
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
    -- Get project key
    select key into v_project_key from public.projects where id = NEW.project_id;
    if v_project_key is null then
        raise exception 'Project not found for task.';
    end if;

    -- Calculate next task number for this project
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

-- 4. Auto-Seed Default Status Columns for New Projects
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

-- 5. Task Assignees Table
create table if not exists public.task_assignees (
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz default now() not null,
    primary key(task_id, user_id)
);

create index if not exists idx_task_assignees_user on public.task_assignees(user_id);

-- 6. Task Checklist Items (Subtasks)
create table if not exists public.task_checklist_items (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    title text not null,
    is_completed boolean default false not null,
    position integer default 0 not null,
    created_at timestamptz default now() not null
);

create index if not exists idx_checklist_task on public.task_checklist_items(task_id, position);

-- 7. Task Comments Table
create table if not exists public.task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at);

-- 8. Task Activity Table
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
-- 9. Row Level Security Policies
-- ------------------------------------------------------------------------------
alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;

-- Task Statuses Policies
create policy "Users can view statuses of accessible projects"
on public.task_statuses for select
using (public.can_view_project(auth.uid(), project_id));

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

-- Tasks Policies
create policy "Users can view non-deleted tasks of accessible projects"
on public.tasks for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

create policy "Users with task.create can insert tasks"
on public.tasks for insert
with check (
    public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'task.create')
);

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

create policy "Users with task.delete can delete tasks"
on public.tasks for delete
using (
    public.is_admin(auth.uid())
    or (creator_id = auth.uid() and public.has_permission(auth.uid(), 'task.delete_own'))
    or public.has_permission(auth.uid(), 'task.delete')
);

-- Task Assignees Policies
create policy "Users can view task assignees"
on public.task_assignees for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

create policy "Users with task.edit can manage task assignees"
on public.task_assignees for all
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.has_permission(auth.uid(), 'task.assign')
    )
);

-- Checklist Items Policies
create policy "Users can view checklist items"
on public.task_checklist_items for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

create policy "Users with task.edit can manage checklist items"
on public.task_checklist_items for all
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.has_permission(auth.uid(), 'task.edit')
    )
);

-- Task Comments Policies
create policy "Users can view task comments"
on public.task_comments for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

create policy "Users can add comments to accessible tasks"
on public.task_comments for insert
with check (
    author_id = auth.uid()
    and exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

create policy "Authors can edit their own comments"
on public.task_comments for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

-- Task Activity Policies
create policy "Users can view task activity"
on public.task_activity for select
using (
    exists (
        select 1 from public.tasks t
        where t.id = task_id and public.can_view_project(auth.uid(), t.project_id)
    )
);

create policy "System can record task activity"
on public.task_activity for insert
with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
