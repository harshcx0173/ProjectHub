import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Verify membership
    const { data: membership, error: memErr } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You are not a member of this conversation' }, { status: 403 });
    }

    // Fetch messages
    const { data: messages, error: msgErr } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        is_deleted,
        created_at,
        updated_at,
        profiles!sender_id (
          id,
          full_name,
          avatar_url,
          org_role
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (msgErr) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: msgErr.message }, { status: 500 });
    }

    // Update last_read_at asynchronously
    try {
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch {}

    const formatted = (messages || []).map((m: any) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderName: m.profiles?.full_name || 'Member',
      senderAvatar: m.profiles?.avatar_url || null,
      senderRole: m.profiles?.org_role || 'Member',
      content: m.content,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      isSelf: m.sender_id === user.id,
    }));

    return NextResponse.json({ messages: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const content = (body.content || '').trim();

    if (!content) {
      return NextResponse.json({ error: 'EMPTY_CONTENT', message: 'Message content cannot be empty' }, { status: 400 });
    }

    // Verify membership
    const { data: membership, error: memErr } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You are not a member of this conversation' }, { status: 403 });
    }

    // Insert message
    const { data: message, error: msgErr } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      })
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        updated_at,
        profiles!sender_id (
          id,
          full_name,
          avatar_url,
          org_role
        )
      `)
      .single();

    if (msgErr) {
      return NextResponse.json({ error: 'SEND_FAILED', message: msgErr.message }, { status: 500 });
    }

    // Update conversation timestamp and notify other members concurrently
    await Promise.allSettled([
      supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId),
      (async () => {
        const { data: otherMembers } = await supabase
          .from('conversation_members')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id);

        if (otherMembers && otherMembers.length > 0) {
          const senderName = (message.profiles as any)?.full_name || 'A team member';
          const notifs = otherMembers.map((m: any) => ({
            user_id: m.user_id,
            actor_id: user.id,
            type: 'mention',
            title: `Message from ${senderName}`,
            body: content.slice(0, 100),
            link_url: `/messages?id=${conversationId}`,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      })(),
    ]);

    return NextResponse.json({
      message: {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        senderName: (message.profiles as any)?.full_name || 'Member',
        senderAvatar: (message.profiles as any)?.avatar_url || null,
        senderRole: (message.profiles as any)?.org_role || 'Member',
        content: message.content,
        createdAt: message.created_at,
        updatedAt: message.updated_at,
        isSelf: true,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
