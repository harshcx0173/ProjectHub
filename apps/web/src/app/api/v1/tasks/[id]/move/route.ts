import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveTaskSchema } from '@project-hub/shared';
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
    const validated = moveTaskSchema.parse({
      ...body,
      taskId,
    });

    // Check existing task & version
    const { data: task, error: fetchErr } = await supabase
      .from('tasks')
      .select('id, project_id, status_id, position, version, title')
      .eq('id', taskId)
      .eq('is_deleted', false)
      .single();

    if (fetchErr || !task) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found' }, { status: 404 });
    }

    if (validated.currentVersion !== undefined && validated.currentVersion !== task.version) {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: 'Task was modified elsewhere. Please refresh before moving.',
          currentVersion: task.version,
        },
        { status: 409 }
      );
    }

    // Update position and status
    const { data: updated, error: updateError } = await supabase
      .from('tasks')
      .update({
        status_id: validated.targetStatusId,
        position: validated.newPosition,
        version: task.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'MOVE_FAILED', message: updateError.message }, { status: 500 });
    }

    // Log move activity
    await supabase.from('task_activity').insert({
      task_id: taskId,
      actor_id: user.id,
      action: 'task.moved',
      details: {
        fromStatus: task.status_id,
        toStatus: validated.targetStatusId,
        newPosition: validated.newPosition,
      },
    });

    return NextResponse.json({ task: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'VALIDATION_ERROR', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
