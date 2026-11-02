import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUserMentioned } from '@/lib/mentions';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 0. Fetch current user profile for mention detection
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const currentUserName = userProfile?.full_name || '';

    // 1. Fetch conversations the user is a member of
    const { data: memberRows, error: memberErr } = await supabase
      .from('conversation_members')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (memberErr) {
      if (memberErr.code === 'PGRST205' || memberErr.message.includes('conversation')) {
        return NextResponse.json({ conversations: [], isTableReady: false });
      }
      return NextResponse.json({ error: 'FETCH_FAILED', message: memberErr.message }, { status: 500 });
    }

    const conversationIds = (memberRows || []).map((m: any) => m.conversation_id);
    if (conversationIds.length === 0) {
      return NextResponse.json({ conversations: [], isTableReady: true });
    }

    // 2. Fetch conversation details
    const { data: convRows, error: convErr } = await supabase
      .from('conversations')
      .select(`
        id,
        type,
        name,
        created_by,
        created_at,
        updated_at,
        conversation_members (
          user_id,
          last_read_at,
          profiles (
            id,
            full_name,
            avatar_url,
            designation,
            org_role
          )
        )
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (convErr) {
      return NextResponse.json({ error: 'FETCH_CONVERSATIONS_FAILED', message: convErr.message }, { status: 500 });
    }

    // 3. Fetch latest message for each conversation
    const formatted = await Promise.all(
      (convRows || []).map(async (c: any) => {
        const { data: latestMsg } = await supabase
          .from('conversation_messages')
          .select(`
            id,
            content,
            created_at,
            sender_id,
            profiles (
              full_name
            )
          `)
          .eq('conversation_id', c.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const allMembers = (c.conversation_members || []).map((m: any) => m.profiles).filter(Boolean);
        const otherMembers = allMembers.filter((m: any) => m.id !== user.id);

        const myMembership = (c.conversation_members || []).find((m: any) => m.user_id === user.id);
        const lastReadAt = myMembership?.last_read_at ? new Date(myMembership.last_read_at).toISOString() : null;

        let unreadCount = 0;
        let hasUnreadMention = false;
        if (latestMsg && latestMsg.sender_id !== user.id) {
          if (!lastReadAt || new Date(latestMsg.created_at) > new Date(lastReadAt)) {
            const { data: unreadRows, count } = await supabase
              .from('conversation_messages')
              .select('id, content', { count: 'exact' })
              .eq('conversation_id', c.id)
              .eq('is_deleted', false)
              .neq('sender_id', user.id)
              .gt('created_at', lastReadAt || '1970-01-01T00:00:00Z');
            unreadCount = count || (unreadRows ? unreadRows.length : 1);
            if (unreadRows && unreadRows.length > 0) {
              hasUnreadMention = unreadRows.some((m: any) =>
                isUserMentioned(m.content, { id: user.id, fullName: currentUserName, email: user.email })
              );
            }
          }
        }

        let displayName = c.name;
        let displayAvatar = null;
        let displaySubtitle = '';

        if (c.type === 'direct') {
          const peer = otherMembers[0] || allMembers[0];
          displayName = peer?.full_name || 'Direct Message';
          displayAvatar = peer?.avatar_url || null;
          displaySubtitle = peer?.org_role || peer?.designation || 'Member';
        } else {
          displayName = c.name || 'Group Chat';
          displaySubtitle = `${allMembers.length} members`;
        }

        return {
          id: c.id,
          type: c.type,
          name: displayName,
          rawName: c.name,
          avatarUrl: displayAvatar,
          subtitle: displaySubtitle,
          membersCount: allMembers.length,
          members: allMembers,
          unreadCount,
          hasUnreadMention,
          latestMessage: latestMsg
            ? {
                id: latestMsg.id,
                content: latestMsg.content,
                senderName: (latestMsg.profiles as any)?.full_name || 'Member',
                createdAt: latestMsg.created_at,
              }
            : null,
          updatedAt: c.updated_at,
        };
      })
    );

    return NextResponse.json({ conversations: formatted, isTableReady: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const { type, targetUserId, name, memberIds } = body;

    if (type === 'direct') {
      if (!targetUserId) {
        return NextResponse.json({ error: 'MISSING_PARAM', message: 'targetUserId is required for direct messages' }, { status: 400 });
      }

      // Check if 1v1 conversation already exists between user.id and targetUserId
      const { data: myConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const convIds = (myConvs || []).map((c: any) => c.conversation_id);

      if (convIds.length > 0) {
        const { data: existingTarget } = await supabase
          .from('conversation_members')
          .select('conversation_id, conversations!inner(id, type)')
          .in('conversation_id', convIds)
          .eq('user_id', targetUserId)
          .eq('conversations.type', 'direct')
          .maybeSingle();

        if (existingTarget) {
          return NextResponse.json({ conversationId: existingTarget.conversation_id, isExisting: true });
        }
      }

      // Create new direct conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr) {
        return NextResponse.json({ error: 'CREATE_FAILED', message: convErr.message }, { status: 500 });
      }

      // Add both members
      const { error: memberInsertErr } = await supabase.from('conversation_members').insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: targetUserId },
      ]);

      if (memberInsertErr) {
        return NextResponse.json({ error: 'CREATE_FAILED', message: memberInsertErr.message }, { status: 500 });
      }

      return NextResponse.json({ conversationId: conv.id, isExisting: false }, { status: 201 });
    } else if (type === 'group') {
      const groupName = (name || '').trim();
      if (!groupName) {
        return NextResponse.json({ error: 'MISSING_PARAM', message: 'Group name is required' }, { status: 400 });
      }

      const membersToAdd = Array.from(new Set([user.id, ...(Array.isArray(memberIds) ? memberIds : [])]));

      // Create group conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name: groupName,
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr) {
        return NextResponse.json({ error: 'CREATE_FAILED', message: convErr.message }, { status: 500 });
      }

      // Add all members
      const memberRows = membersToAdd.map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));

      const { error: groupMembersErr } = await supabase.from('conversation_members').insert(memberRows);
      if (groupMembersErr) {
        return NextResponse.json({ error: 'CREATE_FAILED', message: groupMembersErr.message }, { status: 500 });
      }

      return NextResponse.json({ conversationId: conv.id, isExisting: false }, { status: 201 });
    } else {
      return NextResponse.json({ error: 'INVALID_TYPE', message: 'Type must be "direct" or "group"' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

