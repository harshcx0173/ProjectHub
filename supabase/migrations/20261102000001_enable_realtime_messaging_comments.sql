-- Migration: 20261102000001_enable_realtime_messaging_comments.sql
-- Enables Supabase Realtime and full replica identity for:
-- 1. conversation_messages (1v1 & Teams group chats)
-- 2. conversations (conversation previews & latest messages)
-- 3. messages (project general chat)
-- 4. task_comments (task comments drawer)
-- 5. message_reactions (chat emoji/icon reactions)

-- 1. Set REPLICA IDENTITY FULL for complete payloads on filtered realtime subscriptions
alter table if exists public.conversation_messages replica identity full;
alter table if exists public.conversations replica identity full;
alter table if exists public.messages replica identity full;
alter table if exists public.task_comments replica identity full;
alter table if exists public.message_reactions replica identity full;

-- 2. Add tables to supabase_realtime publication if not already added
do $$
begin
    -- conversation_messages
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'conversation_messages'
    ) then
        alter publication supabase_realtime add table public.conversation_messages;
    end if;

    -- conversations
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'conversations'
    ) then
        alter publication supabase_realtime add table public.conversations;
    end if;

    -- messages
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'messages'
    ) then
        alter publication supabase_realtime add table public.messages;
    end if;

    -- task_comments
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'task_comments'
    ) then
        alter publication supabase_realtime add table public.task_comments;
    end if;

    -- message_reactions
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'message_reactions'
    ) then
        alter publication supabase_realtime add table public.message_reactions;
    end if;
end;
$$;

