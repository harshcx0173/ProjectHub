-- pgTAP Test: Personal Space Sticky Notes RLS Isolation
-- Validates that notes are strictly isolated per user and that admins/other members cannot select or modify another user's notes.

begin;
select plan(7);

-- 1. Table exists
select has_table('public', 'personal_notes', 'Table personal_notes should exist');

-- 2. RLS is enabled
select tests.rls_is_enabled('public', 'personal_notes', 'RLS should be enabled on personal_notes');

-- Setup test users
insert into auth.users (id, email) values 
  ('11111111-1111-1111-1111-111111111111', 'user1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'user2@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin@example.com')
on conflict do nothing;

insert into public.profiles (id, full_name, org_role) values
  ('11111111-1111-1111-1111-111111111111', 'User One', 'Member'),
  ('22222222-2222-2222-2222-222222222222', 'User Two', 'Member'),
  ('33333333-3333-3333-3333-333333333333', 'Admin User', 'Admin')
on conflict do nothing;

-- 3. Authenticate as User 1 and insert note
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

insert into public.personal_notes (id, user_id, title, content)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'User 1 Private Note', 'Secret ideas');

select results_eq(
  $$ select title from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values ('User 1 Private Note') $$,
  'User 1 can read their own note'
);

-- 4. Switch to User 2: Cannot see User 1 note
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$ select * from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'User 2 cannot see User 1 note'
);

-- 5. User 2 cannot update User 1 note
update public.personal_notes set title = 'Tampered' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is_empty(
  $$ select * from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and title = 'Tampered' $$,
  'User 2 update had zero effect'
);

-- 6. Switch to Admin: Admin ALSO cannot see User 1 note (Zero Admin bypass)
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';

select is_empty(
  $$ select * from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'Admin cannot see User 1 personal note (Strict Owner-Only privacy)'
);

-- 7. Admin cannot delete User 1 note
delete from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Verify note still exists under User 1
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$ select count(*)::integer from public.personal_notes where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (1) $$,
  'User 1 note remains intact after admin delete attempt'
);

select * from finish();
rollback;
