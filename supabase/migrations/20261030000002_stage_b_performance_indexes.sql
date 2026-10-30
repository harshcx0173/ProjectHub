-- Migration: Stage B Performance Indexes
-- Description: Composite and foreign key indexes to eliminate table scans, accelerate RLS subqueries, and optimize task/chat filters

-- 1. Role Permissions lookup acceleration (used in public.has_permission RLS check)
create index if not exists idx_role_permissions_role_perm on public.role_permissions(role_id, permission_id);
create index if not exists idx_role_permissions_perm_id on public.role_permissions(permission_id);

-- 2. Project Members composite index for RLS exists subqueries
create index if not exists idx_project_members_composite on public.project_members(project_id, user_id);

-- 3. Task filtering and board queries (active non-deleted tasks)
create index if not exists idx_tasks_project_active on public.tasks(project_id, status_id, position) where is_deleted = false;

-- 4. Task Watchers & Labels tables & indexes
create table if not exists public.task_labels (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    color text not null default '#64748B',
    created_at timestamptz not null default now()
);

create table if not exists public.task_label_assignments (
    task_id uuid not null references public.tasks(id) on delete cascade,
    label_id uuid not null references public.task_labels(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (task_id, label_id)
);

create table if not exists public.task_watchers (
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (task_id, user_id)
);

create index if not exists idx_task_labels_project on public.task_labels(project_id);
create index if not exists idx_task_label_assignments_task on public.task_label_assignments(task_id);
create index if not exists idx_task_watchers_user on public.task_watchers(user_id);

-- Enable RLS on newly created tables
alter table public.task_labels enable row level security;
alter table public.task_label_assignments enable row level security;
alter table public.task_watchers enable row level security;

-- Policies for task_labels
create policy "Project members can view task labels"
on public.task_labels for select
using (
    exists (
        select 1 from public.project_members pm
        where pm.project_id = task_labels.project_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

create policy "Project members can manage task labels"
on public.task_labels for all
using (
    exists (
        select 1 from public.project_members pm
        where pm.project_id = task_labels.project_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

-- Policies for task_label_assignments
create policy "Project members can view label assignments"
on public.task_label_assignments for select
using (
    exists (
        select 1 from public.tasks t
        join public.project_members pm on pm.project_id = t.project_id
        where t.id = task_label_assignments.task_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

create policy "Project members can manage label assignments"
on public.task_label_assignments for all
using (
    exists (
        select 1 from public.tasks t
        join public.project_members pm on pm.project_id = t.project_id
        where t.id = task_label_assignments.task_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

-- Policies for task_watchers
create policy "Project members can view watchers"
on public.task_watchers for select
using (
    exists (
        select 1 from public.tasks t
        join public.project_members pm on pm.project_id = t.project_id
        where t.id = task_watchers.task_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

create policy "Users can manage task watchers"
on public.task_watchers for all
using (
    user_id = auth.uid() or
    exists (
        select 1 from public.tasks t
        join public.project_members pm on pm.project_id = t.project_id
        where t.id = task_watchers.task_id
          and pm.user_id = auth.uid()
    ) or public.has_permission(auth.uid(), 'org.projects.manage')
);

-- 5. Audit logs entity filtering
create index if not exists idx_audit_logs_entity_timeline on public.audit_logs(entity, entity_id, created_at desc);
