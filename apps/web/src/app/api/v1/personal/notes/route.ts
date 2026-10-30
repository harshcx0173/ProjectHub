import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createPersonalNoteSchema, PersonalNotesLimits, PersonalNote } from '@project-hub/shared';
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active'; // 'active' | 'archived' | 'trash'
    const color = searchParams.get('color');
    const search = searchParams.get('search')?.toLowerCase().trim();

    let query = supabase
      .from('personal_notes')
      .select('*')
      .eq('user_id', user.id);

    if (status === 'trash') {
      query = query.eq('is_deleted', true);
    } else if (status === 'archived') {
      query = query.eq('is_archived', true).eq('is_deleted', false);
    } else {
      query = query.eq('is_archived', false).eq('is_deleted', false);
    }

    if (color) {
      query = query.eq('color', color);
    }

    // Order: pinned first, then position ascending, then updated_at descending
    query = query.order('is_pinned', { ascending: false })
      .order('position', { ascending: true })
      .order('updated_at', { ascending: false });

    const { data: rows, error: queryError } = await query;

    if (queryError) {
      // Table may not have been migrated to remote Supabase yet
      if (queryError.code === 'PGRST205' || queryError.message.includes('personal_notes')) {
        return NextResponse.json({ notes: [], isTableReady: false });
      }
      return NextResponse.json({ error: 'FETCH_FAILED', message: queryError.message }, { status: 500 });
    }

    let notes = (rows || []).map(mapDbNoteToPersonalNote);

    if (search) {
      notes = notes.filter((n) =>
        n.title.toLowerCase().includes(search) ||
        n.content.toLowerCase().includes(search) ||
        n.checklistItems.some((item) => item.text.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({ notes, isTableReady: true });
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
    const parsed = createPersonalNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.format() }, { status: 400 });
    }

    const input = parsed.data;

    // Check quota / max notes limit
    const { count, error: countError } = await supabase
      .from('personal_notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    if (!countError && typeof count === 'number' && count >= PersonalNotesLimits.DEFAULT_MAX_NOTES) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: `Maximum limit of ${PersonalNotesLimits.DEFAULT_MAX_NOTES} notes reached. Please archive or delete existing notes.`,
        },
        { status: 400 }
      );
    }

    const newNoteRecord = {
      user_id: user.id,
      title: input.title,
      content_type: input.contentType,
      content: input.content,
      checklist_items: input.checklistItems,
      color: input.color,
      pos_x: input.posX,
      pos_y: input.posY,
      width: input.width,
      height: input.height,
      is_pinned: input.isPinned,
      position: input.position,
      z_index: input.zIndex,
      version: 1,
    };

    const { data: created, error: insertError } = await supabase
      .from('personal_notes')
      .insert(newNoteRecord)
      .select()
      .maybeSingle();

    if (insertError) {
      if (insertError.code === 'PGRST205' || insertError.message.includes('personal_notes')) {
        // Fallback for pre-migration state
        const fallbackNote: PersonalNote = {
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          contentType: input.contentType,
          content: input.content,
          checklistItems: input.checklistItems,
          color: input.color,
          posX: input.posX,
          posY: input.posY,
          width: input.width,
          height: input.height,
          isPinned: input.isPinned,
          isArchived: false,
          isDeleted: false,
          deletedAt: null,
          position: input.position,
          zIndex: input.zIndex,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return NextResponse.json({ note: fallbackNote, isTableReady: false }, { status: 201 });
      }
      return NextResponse.json({ error: 'INSERT_FAILED', message: insertError.message }, { status: 500 });
    }

    const note = mapDbNoteToPersonalNote(created);

    // Audit log: strictly store action and note ID only—NEVER note content or checklist text
    await recordAuditLog({
      actorId: user.id,
      action: 'personal_note.create',
      entity: 'personal_note',
      entityId: note.id,
      metadata: { noteId: note.id },
    }).catch(() => {});

    return NextResponse.json({ note, isTableReady: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
