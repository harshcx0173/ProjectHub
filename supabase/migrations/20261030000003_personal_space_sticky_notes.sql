-- Migration: Stage D Personal Space (Sticky Notes)
-- Description: Create personal_notes table with strict user-isolated Row Level Security (no admin visibility)

create table if not exists public.personal_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
    title text not null default '',
    content_type text not null default 'text' check (content_type in ('text', 'checklist')),
    content text not null default '',
    checklist_items jsonb not null default '[]'::jsonb,
    color text not null default '#FEF08A',
    pos_x integer not null default 100,
    pos_y integer not null default 100,
    width integer not null default 280,
    height integer not null default 260,
    is_pinned boolean not null default false,
    is_archived boolean not null default false,
    is_deleted boolean not null default false,
    deleted_at timestamptz,
    position integer not null default 0,
    z_index integer not null default 1,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes for fast retrieval
create index if not exists idx_personal_notes_user_status 
on public.personal_notes(user_id, is_deleted, is_archived, is_pinned desc, position asc, updated_at desc);

-- Row Level Security: Strict privacy (Default Deny, user isolation, zero admin override)
alter table public.personal_notes enable row level security;

create policy "Users can only select their own personal notes"
on public.personal_notes for select
using (auth.uid() = user_id);

create policy "Users can only insert their own personal notes"
on public.personal_notes for insert
with check (auth.uid() = user_id);

create policy "Users can only update their own personal notes"
on public.personal_notes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can only delete their own personal notes"
on public.personal_notes for delete
using (auth.uid() = user_id);
