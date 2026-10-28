-- ==============================================================================
-- Migration: 20261028000005_chat_and_files.sql
-- Description: Project chat channels, messages, threads, icon-based reactions,
--              file metadata, storage bucket policies, and Realtime replication.
-- ==============================================================================

-- 1. Project Channels Table
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

-- Auto-seed default #general channel for each project
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

-- 2. Messages Table
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    channel_id uuid not null references public.project_channels(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete set null,
    parent_id uuid references public.messages(id) on delete cascade, -- For thread replies
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
create index if not exists idx_messages_pinned on public.messages(channel_id) where is_pinned = true;

-- 3. Message Reactions Table (Icon-based from fixed set, zero emojis)
create table if not exists public.message_reactions (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.messages(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    icon_name text not null check (icon_name in ('thumbs-up', 'check', 'heart', 'flag', 'eye')),
    created_at timestamptz default now() not null,
    unique(message_id, user_id, icon_name)
);

create index if not exists idx_message_reactions_msg on public.message_reactions(message_id);

-- 4. Files Table (Metadata for uploads: Supabase Storage / R2)
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
-- 5. Row Level Security Policies
-- ------------------------------------------------------------------------------
alter table public.project_channels enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.files enable row level security;

-- Channels
create policy "Users can view channels of accessible projects"
on public.project_channels for select
using (public.can_view_project(auth.uid(), project_id));

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
create policy "Users can view messages of accessible projects"
on public.messages for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

create policy "Users with chat.post can send messages"
on public.messages for insert
with check (
    user_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'chat.post')
);

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

create policy "Users can delete their own message or admins can moderate"
on public.messages for delete
using (
    (user_id = auth.uid() and public.has_permission(auth.uid(), 'chat.delete_own'))
    or public.is_admin(auth.uid())
    or public.has_permission(auth.uid(), 'chat.moderate')
);

-- Message Reactions
create policy "Users can view reactions on accessible messages"
on public.message_reactions for select
using (
    exists (
        select 1 from public.messages m
        where m.id = message_id and public.can_view_project(auth.uid(), m.project_id)
    )
);

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

create policy "Users can remove their own reactions"
on public.message_reactions for delete
using (user_id = auth.uid());

-- Files
create policy "Users can view files in accessible projects"
on public.files for select
using (
    not is_deleted and public.can_view_project(auth.uid(), project_id)
);

create policy "Users with file.upload can insert files"
on public.files for insert
with check (
    uploader_id = auth.uid()
    and public.can_view_project(auth.uid(), project_id)
    and public.has_permission(auth.uid(), 'file.upload')
);

create policy "Users can delete own files or managers/admins can delete"
on public.files for delete
using (
    (uploader_id = auth.uid() and public.has_permission(auth.uid(), 'file.delete_own'))
    or public.is_admin(auth.uid())
    or public.has_permission(auth.uid(), 'file.delete')
);

-- ------------------------------------------------------------------------------
-- 6. Supabase Storage Bucket Configuration (project-files)
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'project-files',
    'project-files',
    false, -- Private bucket, access via signed URLs
    52428800, -- 50 MB max size
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

-- Storage RLS: Users can access files only if they belong to the project folder path
-- Storage object name format: {project_id}/{unique_filename}
create policy "Users can view project files in storage"
on storage.objects for select
using (
    bucket_id = 'project-files'
    and (
        auth.role() = 'service_role'
        or public.can_view_project(auth.uid(), (storage.foldername(name))[1]::uuid)
    )
);

create policy "Users with permission can upload to project files bucket"
on storage.objects for insert
with check (
    bucket_id = 'project-files'
    and (
        auth.role() = 'service_role'
        or (
            public.can_view_project(auth.uid(), (storage.foldername(name))[1]::uuid)
            and public.has_permission(auth.uid(), 'file.upload')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 7. Supabase Realtime Publication Enablement
-- ------------------------------------------------------------------------------
do $$
begin
    -- Add messages to realtime publication if not already added
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;

    -- Add message_reactions to realtime publication
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'message_reactions'
    ) then
        alter publication supabase_realtime add table public.message_reactions;
    end if;
end;
$$;
