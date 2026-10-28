import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasEditPerm = await checkUserPermission(user.id, 'task.edit');
    if (!hasEditPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing task.edit permission' }, { status: 403 });
    }

    const body = await request.json();
    const title = (body.title || '').trim();

    if (!title) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Title is required' }, { status: 400 });
    }

    // Get max position
    const { data: posData } = await supabase
      .from('task_checklist_items')
      .select('position')
      .eq('task_id', taskId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPos = posData ? posData.position + 1 : 0;

    const { data: item, error } = await supabase
      .from('task_checklist_items')
      .insert({
        task_id: taskId,
        title,
        position: nextPos,
        is_completed: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'CREATE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasEditPerm = await checkUserPermission(user.id, 'task.edit');
    if (!hasEditPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing task.edit permission' }, { status: 403 });
    }

    const body = await request.json();
    const { itemId, isCompleted, title } = body;

    if (!itemId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'itemId is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (isCompleted !== undefined) updates.is_completed = Boolean(isCompleted);
    if (title !== undefined) updates.title = title.trim();

    const { data: updated, error } = await supabase
      .from('task_checklist_items')
      .update(updates)
      .eq('id', itemId)
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasEditPerm = await checkUserPermission(user.id, 'task.edit');
    if (!hasEditPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing task.edit permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'itemId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('task_checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('task_id', taskId);

    if (error) {
      return NextResponse.json({ error: 'DELETE_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
