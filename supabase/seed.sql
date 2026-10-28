-- ==============================================================================
-- Supabase Seed Data
-- Seed System Roles, Permissions Catalog, and Org Settings
-- ==============================================================================

-- 1. Insert System Roles
insert into public.roles (name, is_system, is_locked, description)
values
    ('Admin', true, true, 'Full administrative access across organization and all projects'),
    ('Manager', true, false, 'Can create projects, manage assigned projects, tasks, and messages'),
    ('Member', true, false, 'Standard project member with task and messaging participation')
on conflict (name) do update 
set is_system = excluded.is_system,
    is_locked = excluded.is_locked,
    description = excluded.description;

-- 2. Insert Permissions Catalog
insert into public.permissions (key, scope, group_name, label, description, is_assignable)
values
    -- Org Scope
    ('org.settings.manage', 'org', 'settings', 'Manage Organization Settings', 'Update organization name, logo, working days, and timezone', false),
    ('org.users.view', 'org', 'users', 'View Users', 'View the organization member directory', false),
    ('org.users.manage', 'org', 'users', 'Manage Users', 'Change user roles and reassign tasks during offboarding', false),
    ('org.users.disable', 'org', 'users', 'Disable Users', 'Deactivate user accounts and revoke all active sessions', false),
    ('org.invitations.manage', 'org', 'invitations', 'Manage Invitations', 'Invite new users, resend, revoke, and copy invite links', false),
    ('org.roles.manage', 'org', 'roles', 'Manage Roles', 'Create and configure custom roles (Admin locked)', false),
    ('org.audit.view', 'org', 'audit', 'View Audit Logs', 'View administrative and security audit trail', false),
    ('project.create', 'org', 'project', 'Create Project', 'Create new projects and project groups', true),

    -- Project Scope
    ('project.view', 'project', 'project', 'View Project', 'Access project workspace, board, chat, and files', true),
    ('project.edit', 'project', 'project', 'Edit Project Info & Icon', 'Edit project name, description, color, and icon (Admin only)', false),
    ('project.archive', 'project', 'project', 'Archive Project', 'Archive or restore projects (Admin only)', false),
    ('project.members.manage', 'project', 'project', 'Manage Project Members', 'Add or remove members from projects', true),
    ('project.settings.manage', 'project', 'project', 'Manage Project Settings', 'Configure project columns and preferences', true),
    ('task.create', 'project', 'task', 'Create Tasks', 'Create new tasks in project columns', true),
    ('task.edit', 'project', 'task', 'Edit Tasks', 'Edit task titles, descriptions, due dates, and checklist items', true),
    ('task.assign', 'project', 'task', 'Assign Tasks', 'Assign or reassign tasks to team members', true),
    ('task.delete', 'project', 'task', 'Delete Any Task', 'Delete tasks created by any member', true),
    ('task.delete_own', 'project', 'task', 'Delete Own Tasks', 'Delete tasks created by yourself', true),
    ('chat.read', 'project', 'chat', 'Read Project Chat', 'Read realtime messages and threads in project channels', true),
    ('chat.send', 'project', 'chat', 'Send Project Messages', 'Post messages, replies, mentions, and icon reactions', true),
    ('chat.message.edit_own', 'project', 'chat', 'Edit Own Messages', 'Edit your own sent messages', true),
    ('chat.message.delete_own', 'project', 'chat', 'Delete Own Messages', 'Delete your own sent messages', true),
    ('chat.message.delete_any', 'project', 'chat', 'Moderation: Delete Any Message', 'Delete any message in the channel', false),
    ('chat.message.pin', 'project', 'chat', 'Pin Messages', 'Pin important messages to channel header', true),
    ('file.upload', 'project', 'file', 'Upload Files', 'Upload files and attachments in chat and tasks', true),
    ('file.delete_own', 'project', 'file', 'Delete Own Files', 'Delete files uploaded by yourself', true),
    ('file.delete_any', 'project', 'file', 'Delete Any File', 'Delete any file in the project', false)
on conflict (key) do update 
set scope = excluded.scope,
    group_name = excluded.group_name,
    label = excluded.label,
    description = excluded.description,
    is_assignable = excluded.is_assignable;

-- 3. Map Permissions to System Roles
-- Admin gets ALL permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Admin'
on conflict (role_id, permission_id) do nothing;

-- Manager gets predefined manager permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
    'project.create',
    'project.view',
    'project.members.manage',
    'project.settings.manage',
    'task.create',
    'task.edit',
    'task.assign',
    'task.delete',
    'task.delete_own',
    'chat.read',
    'chat.send',
    'chat.message.edit_own',
    'chat.message.delete_own',
    'chat.message.delete_any',
    'chat.message.pin',
    'file.upload',
    'file.delete_own',
    'file.delete_any'
)
where r.name = 'Manager'
on conflict (role_id, permission_id) do nothing;

-- Member gets standard member permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
    'project.view',
    'task.create',
    'task.edit',
    'task.assign',
    'task.delete_own',
    'chat.read',
    'chat.send',
    'chat.message.edit_own',
    'chat.message.delete_own',
    'file.upload',
    'file.delete_own'
)
where r.name = 'Member'
on conflict (role_id, permission_id) do nothing;

-- 4. Seed Organization Settings
insert into public.org_settings (company_name, app_name, timezone, working_days)
select 'Hydrated Studio', 'Project Hub', 'UTC', '{1,2,3,4,5}'
where not exists (select 1 from public.org_settings);
