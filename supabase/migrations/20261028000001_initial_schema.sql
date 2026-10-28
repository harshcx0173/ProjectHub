-- ==============================================================================
-- Migration: 20261028000001_initial_schema.sql
-- Description: Core identity, roles, permissions, invitations, org settings, 
--              audit logs, and RLS with Last-Admin protection.
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Roles & Permissions Tables
-- ------------------------------------------------------------------------------
create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    is_system boolean default false,
    is_locked boolean default false,
    description text,
    created_at timestamptz default now() not null
);

create table if not exists public.permissions (
    id uuid primary key default gen_random_uuid(),
    key text unique not null,
    scope text not null check (scope in ('org', 'project')),
    group_name text not null,
    label text not null,
    description text,
    is_assignable boolean default true not null,
    created_at timestamptz default now() not null
);

create table if not exists public.role_permissions (
    id uuid primary key default gen_random_uuid(),
    role_id uuid not null references public.roles(id) on delete cascade,
    permission_id uuid not null references public.permissions(id) on delete cascade,
    created_at timestamptz default now() not null,
    unique(role_id, permission_id)
);

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (Linked 1:1 with auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    avatar_url text,
    designation text,
    timezone text default 'UTC' not null,
    status text not null check (status in ('active', 'disabled')) default 'active',
    org_role text not null references public.roles(name) default 'Member',
    is_totp_enabled boolean default false not null,
    totp_secret text,
    totp_recovery_codes text[] default '{}',
    last_seen_at timestamptz,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Index for quick lookups on active status and role
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_org_role on public.profiles(org_role);

-- ------------------------------------------------------------------------------
-- 3. Last Admin Protection (Trigger)
-- Ensures the last active Admin cannot be deleted, disabled, or demoted
-- ------------------------------------------------------------------------------
create or replace function public.check_last_admin_protection()
returns trigger
language plpgsql
security definer
as $$
declare
    v_admin_count integer;
begin
    -- On delete of an Admin profile
    if TG_OP = 'DELETE' then
        if OLD.org_role = 'Admin' and OLD.status = 'active' then
            select count(*) into v_admin_count
            from public.profiles
            where org_role = 'Admin' and status = 'active' and id != OLD.id;
            
            if v_admin_count = 0 then
                raise exception 'Operation rejected: The organization must have at least one active Admin.';
            end if;
        end if;
        return OLD;
    end if;

    -- On update of an Admin profile
    if TG_OP = 'UPDATE' then
        if OLD.org_role = 'Admin' and (NEW.org_role != 'Admin' or NEW.status != 'active') then
            select count(*) into v_admin_count
            from public.profiles
            where org_role = 'Admin' and status = 'active' and id != OLD.id;
            
            if v_admin_count = 0 then
                raise exception 'Operation rejected: Cannot demote or disable the last active Admin.';
            end if;
        end if;
        return NEW;
    end if;

    return NEW;
end;
$$;

drop trigger if exists tr_last_admin_protection on public.profiles;
create trigger tr_last_admin_protection
before update or delete on public.profiles
for each row
execute function public.check_last_admin_protection();

-- ------------------------------------------------------------------------------
-- 4. Organization Settings Table
-- ------------------------------------------------------------------------------
create table if not exists public.org_settings (
    id uuid primary key default gen_random_uuid(),
    company_name text not null default 'Hydrated Studio',
    app_name text not null default 'Project Hub',
    logo_url text,
    timezone text not null default 'UTC',
    working_days integer[] default '{1,2,3,4,5}' not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 5. Invitations Table (Hash-only storage)
-- ------------------------------------------------------------------------------
create table if not exists public.invitations (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    org_role text not null references public.roles(name) default 'Member',
    preset_projects uuid[] default '{}' not null,
    token_hash text unique not null,
    expires_at timestamptz not null,
    accepted_at timestamptz,
    revoked_at timestamptz,
    invited_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now() not null
);

create index if not exists idx_invitations_token_hash on public.invitations(token_hash);
create index if not exists idx_invitations_email on public.invitations(email);

-- ------------------------------------------------------------------------------
-- 6. Audit Logs Table
-- ------------------------------------------------------------------------------
create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id) on delete set null,
    action text not null,
    entity text not null,
    entity_id text,
    metadata jsonb default '{}'::jsonb not null,
    ip_address text,
    user_agent text,
    created_at timestamptz default now() not null
);

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs(action);

-- ------------------------------------------------------------------------------
-- 7. Helper Security & Permission Functions (Security Definer with search_path to prevent RLS recursion)
-- ------------------------------------------------------------------------------
create or replace function public.is_active_member(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.profiles
        where id = p_user_id and status = 'active'
    );
$$;

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.profiles
        where id = p_user_id and org_role = 'Admin' and status = 'active'
    );
$$;

create or replace function public.has_permission(p_user_id uuid, p_permission_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1
        from public.profiles p
        join public.roles r on r.name = p.org_role
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        where p.id = p_user_id
          and p.status = 'active'
          and perm.key = p_permission_key
    );
$$;

-- Trigger to prevent self-role elevation during profile update
create or replace function public.check_profile_update_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() = OLD.id and not public.is_admin(auth.uid()) then
        if NEW.org_role != OLD.org_role then
            raise exception 'Permission denied: Cannot change your own organization role.';
        end if;
        if NEW.status != OLD.status then
            raise exception 'Permission denied: Cannot change your own account status.';
        end if;
    end if;
    return NEW;
end;
$$;

drop trigger if exists tr_profile_update_security on public.profiles;
create trigger tr_profile_update_security
before update on public.profiles
for each row
execute function public.check_profile_update_security();

-- ------------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies — Default Deny
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.org_settings enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles Policies (Recursion-Free)
drop policy if exists "Active users can view other profiles" on public.profiles;
drop policy if exists "Users can view profiles" on public.profiles;
create policy "Users can view profiles"
on public.profiles for select
using (
    auth.uid() = id or public.is_active_member(auth.uid())
);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id and public.is_active_member(auth.uid()))
with check (auth.uid() = id);

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
on public.profiles for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Roles & Permissions Policies
create policy "Authenticated users can view roles"
on public.roles for select
using (auth.role() = 'authenticated');

create policy "Admins can manage custom roles"
on public.roles for all
using (public.has_permission(auth.uid(), 'org.roles.manage'));

create policy "Authenticated users can view permissions"
on public.permissions for select
using (auth.role() = 'authenticated');

create policy "Authenticated users can view role_permissions"
on public.role_permissions for select
using (auth.role() = 'authenticated');

create policy "Admins can manage role_permissions"
on public.role_permissions for all
using (public.has_permission(auth.uid(), 'org.roles.manage'));

-- Org Settings Policies
create policy "Authenticated users can view org settings"
on public.org_settings for select
using (auth.role() = 'authenticated');

create policy "Admins can manage org settings"
on public.org_settings for update
using (public.has_permission(auth.uid(), 'org.settings.manage'))
with check (public.has_permission(auth.uid(), 'org.settings.manage'));

-- Invitations Policies
create policy "Admins can view invitations"
on public.invitations for select
using (public.has_permission(auth.uid(), 'org.invitations.manage'));

create policy "Admins can create invitations"
on public.invitations for insert
with check (public.has_permission(auth.uid(), 'org.invitations.manage'));

create policy "Admins can update invitations (revoke/resend)"
on public.invitations for update
using (public.has_permission(auth.uid(), 'org.invitations.manage'));

-- Audit Logs Policies
create policy "Admins can view audit logs"
on public.audit_logs for select
using (public.has_permission(auth.uid(), 'org.audit.view'));

create policy "System can insert audit logs"
on public.audit_logs for insert
with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
