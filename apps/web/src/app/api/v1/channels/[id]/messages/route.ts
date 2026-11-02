import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { getMentionNotificationTitle } from '@/lib/mentions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        project_id,
        channel_id,
        user_id,
        parent_id,
        content,
        is_pinned,
        is_edited,
        is_deleted,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          avatar_url,
          designation
        ),
        message_reactions (
          id,
          icon_name,
          user_id
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const formattedMessages = (messages || []).map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      channelId: m.channel_id,
      userId: m.user_id,
      parentId: m.parent_id,
      content: m.content,
      isPinned: m.is_pinned,
      isEdited: m.is_edited,
      createdAt: m.created_at,
      author: m.profiles,
      reactions: m.message_reactions || [],
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasPostPerm = await checkUserPermission(user.id, 'chat.send');
    if (!hasPostPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing chat.send permission' }, { status: 403 });
    }

    const body = await request.json();
    const content = (body.content || '').trim();
    const parentId = body.parentId || null;

    if (!content) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Message content cannot be empty' }, { status: 400 });
    }

    // Get project id and channel name
    const { data: channel, error: chanErr } = await supabase
      .from('project_channels')
      .select('project_id, name')
      .eq('id', channelId)
      .single();

    if (chanErr || !channel) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Channel not found' }, { status: 404 });
    }

    // Insert message
    const { data: message, error: insertErr } = await supabase
      .from('messages')
      .insert({
        project_id: channel.project_id,
        channel_id: channelId,
        user_id: user.id,
        parent_id: parentId,
        content,
      })
      .select(`
        id,
        project_id,
        channel_id,
        user_id,
        parent_id,
        content,
        is_pinned,
        is_edited,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url,
          designation
        )
      `)
      .single();

    if (insertErr) {
      return NextResponse.json({ error: 'INSERT_FAILED', message: insertErr.message }, { status: 500 });
    }

    // Notify other project members about the message or mention
    const { data: projectMembers } = await supabase
      .from('project_members')
      .select(`
        user_id,
        profiles (
          id,
          full_name
        )
      `)
      .eq('project_id', channel.project_id)
      .neq('user_id', user.id);

    if (projectMembers && projectMembers.length > 0) {
      const senderName = (message.profiles as any)?.full_name || 'A team member';
      const channelName = channel.name || 'general';
      const notifs = projectMembers.map((m: any) => {
        const recipientTarget = {
          id: m.user_id,
          fullName: (m.profiles as any)?.full_name || '',
        };
        const { title, isMention } = getMentionNotificationTitle(
          content,
          recipientTarget,
          senderName,
          `${senderName} in #${channelName}`
        );
        return {
          user_id: m.user_id,
          actor_id: user.id,
          type: isMention ? 'mention' : 'system',
          title,
          body: content.slice(0, 150),
          link_url: `/projects/${channel.project_id}/board`,
        };
      });
      await supabase.from('notifications').insert(notifs);
    }

    return NextResponse.json({
      message: {
        id: message.id,
        projectId: message.project_id,
        channelId: message.channel_id,
        userId: message.user_id,
        parentId: message.parent_id,
        content: message.content,
        isPinned: message.is_pinned,
        isEdited: message.is_edited,
        createdAt: message.created_at,
        author: message.profiles,
        reactions: [],
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
