import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updatePersonalNoteSchema, PersonalNote } from '@project-hub/shared';
import { recordAuditLog } from '@/lib/audit';

function mapDbNoteToPersonalNote(row: any): PersonalNote {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title || '',
    contentType: (row.content_type as 'text' | 'checklist') || 'text',
    content: row.content || '',
    checklistItems: Array.isArray(row.checklist_items) ? row.checklist_items : [],
    color: row.color || '#FEF08A',
    posX: row.pos_x ?? 100,
    posY: row.pos_y ?? 100,
    width: row.width ?? 280,
    height: row.height ?? 260,
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at || null,
    position: row.position ?? 0,
    zIndex: row.z_index ?? 1,
    version: row.version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updatePersonalNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.format() }, { status: 400 });
    }

    const input = parsed.data;

    // Fetch existing note for version and ownership check
    const { data: existing, error: fetchError } = await supabase
      .from('personal_notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === 'PGRST205' || fetchError.message.includes('personal_notes')) {
        // Table not migrated yet; allow client optimistic sync
        return NextResponse.json({ note: { id, ...input, updatedAt: new Date().toISOString() }, isTableReady: false });
      }
      return NextResponse.json({ error: 'FETCH_FAILED', message: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Note not found' }, { status: 404 });
    }

    // Optimistic Concurrency Control check
    if (typeof input.version === 'number' && input.version !== existing.version) {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: 'This note was modified in another session. Please refresh.',
          currentNote: mapDbNoteToPersonalNote(existing),
        },
        { status: 409 }
      );
    }

    const updates: Record<string, any> = {
      version: (existing.version || 1) + 1,
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.contentType !== undefined) updates.content_type = input.contentType;
    if (input.content !== undefined) updates.content = input.content;
    if (input.checklistItems !== undefined) updates.checklist_items = input.checklistItems;
    if (input.color !== undefined) updates.color = input.color;
    if (input.posX !== undefined) updates.pos_x = input.posX;
    if (input.posY !== undefined) updates.pos_y = input.posY;
    if (input.width !== undefined) updates.width = input.width;
    if (input.height !== undefined) updates.height = input.height;
    if (input.isPinned !== undefined) updates.is_pinned = input.isPinned;
    if (input.isArchived !== undefined) updates.is_archived = input.isArchived;
    if (input.position !== undefined) updates.position = input.position;
    if (input.zIndex !== undefined) updates.z_index = input.zIndex;

    if (input.isDeleted !== undefined) {
      updates.is_deleted = input.isDeleted;
      updates.deleted_at = input.isDeleted ? new Date().toISOString() : null;
    }

    const { data: updated, error: updateError } = await supabase
      .from('personal_notes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    const note = mapDbNoteToPersonalNote(updated);

    // Audit log: strictly store action and note ID only—NEVER note content or checklist text
    await recordAuditLog({
      actorId: user.id,
      action: input.isDeleted ? 'personal_note.trash' : input.isArchived ? 'personal_note.archive' : 'personal_note.update',
      entity: 'personal_note',
      entityId: id,
      metadata: { noteId: id },
    }).catch(() => {});

    return NextResponse.json({ note, isTableReady: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { error: deleteError } = await supabase
      .from('personal_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      if (deleteError.code === 'PGRST205' || deleteError.message.includes('personal_notes')) {
        return NextResponse.json({ success: true, isTableReady: false });
      }
      return NextResponse.json({ error: 'DELETE_FAILED', message: deleteError.message }, { status: 500 });
    }

    // Audit log: strictly store action and note ID only—NEVER note content or checklist text
    await recordAuditLog({
      actorId: user.id,
      action: 'personal_note.delete',
      entity: 'personal_note',
      entityId: id,
      metadata: { noteId: id },
    }).catch(() => {});

    return NextResponse.json({ success: true, isTableReady: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
