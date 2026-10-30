import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const { content, isPinned } = body;

    // Fetch existing message
    const { data: existing, error: fetchErr } = await supabase
      .from('messages')
      .select('id, user_id, project_id, is_pinned')
      .eq('id', messageId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Message not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      // Must be owner to edit content
      if (existing.user_id !== user.id) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'You can only edit your own messages' },
          { status: 403 }
        );
      }
      updates.content = content.trim();
      updates.is_edited = true;
    }

    if (isPinned !== undefined) {
      // Pinning requires permission or admin
      const hasPinPerm = await checkUserPermission(user.id, 'chat.message.pin');
      if (!hasPinPerm) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Missing chat.message.pin permission' },
          { status: 403 }
        );
      }
      updates.is_pinned = !!isPinned;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('messages')
      .select('id, user_id, project_id')
      .eq('id', messageId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Message not found' }, { status: 404 });
    }

    const isOwner = existing.user_id === user.id;
    const hasDeleteAny = await checkUserPermission(user.id, 'chat.message.delete_any');
    const hasDeleteOwn = await checkUserPermission(user.id, 'chat.message.delete_own');

    if (!isOwner && !hasDeleteAny) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'You cannot delete another member message without moderation rights' },
        { status: 403 }
      );
    }

    if (isOwner && !hasDeleteOwn && !hasDeleteAny) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Missing chat.message.delete_own permission' },
        { status: 403 }
      );
    }

    // Soft delete message
    const { error: delErr } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        content: 'This message was deleted.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (delErr) {
      return NextResponse.json({ error: 'DELETE_FAILED', message: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Message soft-deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

