-- ==============================================================================
-- Migration: 20261028000003_projects_and_search.sql
-- Description: Project Groups, Projects, Project Members, User Preferences,
--              Postgres Full-Text Search, and Admin-Only Icon Protection Trigger.
-- ==============================================================================

-- 1. Project Groups Table (Folders)
create table if not exists public.project_groups (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    position integer default 0 not null,
    created_at timestamptz default now() not null
);

-- 2. Projects Table
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

-- 3. Project Members Table
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

-- 4. User Project Preferences (Pinned, Recent, Muted per user)
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
-- 5. Admin-Only Project Icon & Color Protection (Trigger)
-- Non-admin cannot alter project icon, color, or archive status even by direct API
-- ------------------------------------------------------------------------------
create or replace function public.check_project_admin_field_protection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- If user is NOT an Admin
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
-- 6. Helper Function: Can User View Project
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
-- 7. Row Level Security Policies
-- ------------------------------------------------------------------------------
alter table public.project_groups enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.user_project_prefs enable row level security;

-- Project Groups Policies
create policy "Authenticated users can view project groups"
on public.project_groups for select
using (auth.role() = 'authenticated');

create policy "Users with project.create can create project groups"
on public.project_groups for insert
with check (public.has_permission(auth.uid(), 'project.create'));

create policy "Admins can update and delete project groups"
on public.project_groups for all
using (public.is_admin(auth.uid()));

-- Projects Policies
create policy "Users can view authorized projects"
on public.projects for select
using (
    public.is_admin(auth.uid())
    or exists (
        select 1 from public.project_members pm
        where pm.project_id = id and pm.user_id = auth.uid()
    )
);

create policy "Users with project.create can insert projects"
on public.projects for insert
with check (public.has_permission(auth.uid(), 'project.create'));

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

create policy "Admins can delete projects"
on public.projects for delete
using (public.is_admin(auth.uid()));

-- Project Members Policies
create policy "Users can view members of accessible projects"
on public.project_members for select
using (public.can_view_project(auth.uid(), project_id));

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

-- User Preferences Policies
create policy "Users can manage their own project preferences"
on public.user_project_prefs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 8. Global Full-Text Search Function
-- Searches projects, tasks, files, and users strictly scoped to authorized data
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
    -- 1. Search Projects the user is allowed to view
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
    limit 10;

    -- 2. Search People/Users (if user is active member)
    if public.is_active_member(v_user_id) then
        return query
        select 
            'person'::text as result_type,
            prof.id,
            prof.full_name as title,
            coalesce(prof.designation, prof.org_role) as subtitle,
            null::uuid as project_id,
            null::text as project_name,
            ('/team?user=' || prof.id::text)::text as url
        from public.profiles prof
        where prof.status = 'active'
          and (
              prof.full_name ilike ('%' || p_query || '%')
              or prof.designation ilike ('%' || p_query || '%')
          )
        limit 10;
    end if;

    return;
end;
$$;
