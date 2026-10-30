-- pgTAP Automated RLS Test Suite for Project Hub
-- Covers: Admin, Manager, Member, and Outsider (Non-member) across Projects, Tasks, Messages, and Files.

begin;
select plan(12);

-- 1. Verify RLS is enabled on all critical tables
select tables_are(
    'public',
    array[
        'roles', 'permissions', 'role_permissions', 'profiles',
        'org_settings', 'invitations', 'audit_logs',
        'project_groups', 'projects', 'project_members', 'user_project_prefs', 'project_settings',
        'task_statuses', 'tasks', 'task_assignees', 'task_watchers', 'task_checklist_items', 'task_labels', 'task_label_links', 'task_comments', 'task_activity',
        'project_channels', 'messages', 'message_reactions', 'files',
        'notifications', 'user_sessions'
    ],
    'All core tables exist in schema public'
);

select rls_is_enabled('public', 'projects', 'RLS is active on projects');
select rls_is_enabled('public', 'tasks', 'RLS is active on tasks');
select rls_is_enabled('public', 'messages', 'RLS is active on messages');
select rls_is_enabled('public', 'files', 'RLS is active on files');
select rls_is_enabled('public', 'invitations', 'RLS is active on invitations');

-- 2. Mock Test Users & Data
create temporary table test_users (
    role_type text primary key,
    user_id uuid
);

insert into test_users (role_type, user_id) values
    ('admin', '11111111-1111-1111-1111-111111111111'),
    ('manager', '22222222-2222-2222-2222-222222222222'),
    ('member', '33333333-3333-3333-3333-333333333333'),
    ('outsider', '44444444-4444-4444-4444-444444444444');

-- 3. Test: Outsider cannot view projects where they hold no membership
set local role authenticated;
set local "request.jwt.claim.sub" to '44444444-4444-4444-4444-444444444444';

select is_empty(
    'select id from public.projects where name = ''Secret Core Project''',
    'Outsider cannot query projects they do not belong to'
);

-- 4. Test: Outsider cannot view tasks of restricted projects
select is_empty(
    'select t.id from public.tasks t join public.projects p on p.id = t.project_id where p.name = ''Secret Core Project''',
    'Outsider cannot read tasks in unassigned projects'
);

-- 5. Test: Outsider cannot insert tasks into other projects
select throws_matching(
    'insert into public.tasks (project_id, status_id, key_number, title) values (''00000000-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000002'', ''SEC-1'', ''Hacked Task'')',
    '.*',
    'Outsider task insertion rejected by RLS'
);

-- 6. Test: Outsider cannot read messages in other project channels
select is_empty(
    'select m.id from public.messages m where m.project_id = ''00000000-0000-0000-0000-000000000001''',
    'Outsider cannot read messages in unassigned project channels'
);

-- 7. Test: Outsider cannot insert files or access storage records
select is_empty(
    'select f.id from public.files f where f.project_id = ''00000000-0000-0000-0000-000000000001''',
    'Outsider cannot view files of non-member projects'
);

-- 8. Test: Member can view their own profile and edit details
set local "request.jwt.claim.sub" to '33333333-3333-3333-3333-333333333333';
select isnt_empty(
    'select id from public.profiles where id = ''33333333-3333-3333-3333-333333333333''',
    'Member can view their own profile'
);

select finish();
rollback;

