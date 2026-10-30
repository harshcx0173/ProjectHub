-- ==============================================================================
-- Migration: 20261030000001_stage_a_permissions_and_constraints.sql
-- Description: Additive migration for Stage A:
--              1. New task permissions: task.self_assign, task.assignable
--              2. Map default permissions for Manager & Member
--              3. Trigger constraint preventing locked permissions from being assigned to non-Admin roles
--              4. Additive policy on task_assignees for self_assign
-- ==============================================================================

-- 1. Insert new task assignment permissions
insert into public.permissions (key, scope, group_name, label, description, is_assignable)
values
    ('task.assign', 'project', 'task', 'Assign Tasks to Others', 'Assign or reassign tasks to team members', true),
    ('task.self_assign', 'project', 'task', 'Self-Assign Tasks', 'Assign or unassign oneself to tasks', true),
    ('task.assignable', 'project', 'task', 'Assignable to Tasks', 'Permit this role to be selected as a task assignee', true)
on conflict (key) do update
set scope = excluded.scope,
    group_name = excluded.group_name,
    label = excluded.label,
    description = excluded.description,
    is_assignable = excluded.is_assignable;

-- 2. Map new permissions to Admin (gets all permissions)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Admin'
  and p.key in ('task.self_assign', 'task.assignable')
on conflict (role_id, permission_id) do nothing;

-- 3. Map new permissions to Manager (task.assign, task.self_assign, task.assignable)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Manager'
  and p.key in ('task.assign', 'task.self_assign', 'task.assignable')
on conflict (role_id, permission_id) do nothing;

-- 4. Map new permissions to Member (task.self_assign, task.assignable)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Member'
  and p.key in ('task.self_assign', 'task.assignable')
on conflict (role_id, permission_id) do nothing;

-- 5. Trigger constraint: prevent assigning locked permissions to non-Admin roles
create or replace function public.check_locked_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role_name text;
    v_perm_assignable boolean;
    v_perm_key text;
begin
    select name into v_role_name
    from public.roles
    where id = NEW.role_id;

    select key, is_assignable into v_perm_key, v_perm_assignable
    from public.permissions
    where id = NEW.permission_id;

    -- Locked permissions (org.roles.manage, non-assignable keys) can NEVER be assigned to non-Admin roles
    if v_role_name != 'Admin' and (not v_perm_assignable or v_perm_key = 'org.roles.manage') then
        raise exception 'Locked permission "%" can only be assigned to the Admin role.', v_perm_key;
    end if;

    return NEW;
end;
$$;

drop trigger if exists trg_prevent_locked_permissions on public.role_permissions;
create trigger trg_prevent_locked_permissions
before insert or update on public.role_permissions
for each row
execute function public.check_locked_role_permissions();

-- 6. Additive policy for task.self_assign on task_assignees
do $$
begin
    if not exists (
        select 1 from pg_policies 
        where schemaname = 'public' 
          and tablename = 'task_assignees' 
          and policyname = 'Users with task.self_assign can manage own task assignment'
    ) then
        create policy "Users with task.self_assign can manage own task assignment"
        on public.task_assignees for all
        using (
            user_id = auth.uid() and public.has_permission(auth.uid(), 'task.self_assign')
        )
        with check (
            user_id = auth.uid() and public.has_permission(auth.uid(), 'task.self_assign')
        );
    end if;
end;
$$;
