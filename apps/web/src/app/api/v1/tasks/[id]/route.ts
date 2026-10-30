import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateTaskSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
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

    // 1. Fetch task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        project_id,
        status_id,
        task_number,
        task_key,
        title,
        description,
        priority,
        due_date,
        position,
        version,
        creator_id,
        is_deleted,
        created_at,
        updated_at,
        projects (
          id,
          name,
          key
        ),
        task_statuses (
          id,
          name,
          color
        ),
        task_assignees (
          user_id,
          profiles (
            id,
            full_name,
            avatar_url,
            designation
          )
        ),
        task_checklist_items (
          id,
          title,
          is_completed,
          position
        ),
        task_comments (
          id,
          content,
          created_at,
          updated_at,
          profiles (
            id,
            full_name,
            avatar_url
          )
        ),
        task_activity (
          id,
          action,
          details,
          created_at,
          profiles (
            id,
            full_name
          )
        )
      `)
      .eq('id', taskId)
      .eq('is_deleted', false)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      task: {
        id: task.id,
        projectId: task.project_id,
        project: task.projects,
        statusId: task.status_id,
        status: task.task_statuses,
        taskNumber: task.task_number,
        taskKey: task.task_key,
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.due_date,
        position: task.position,
        version: task.version,
        creatorId: task.creator_id,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        assignees: (task.task_assignees || []).map((a: any) => a.profiles).filter(Boolean),
        checklistItems: (task.task_checklist_items || []).sort((a: any, b: any) => a.position - b.position),
        comments: (task.task_comments || [])
          .sort(
            (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
          .map((c: any) => ({
            id: c.id,
            content: c.content,
            createdAt: c.created_at,
            created_at: c.created_at,
            updatedAt: c.updated_at,
            author: c.profiles,
            profiles: c.profiles,
          })),
        activity: (task.task_activity || [])
          .sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          .map((act: any) => ({
            id: act.id,
            action: act.action,
            details: act.details,
            createdAt: act.created_at,
            created_at: act.created_at,
            profiles: act.profiles,
            author: act.profiles,
          })),
      },
    });
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
    const validated = updateTaskSchema.parse(body);

    // Fetch existing task to check optimistic locking version and project access
    const { data: existing, error: fetchErr } = await supabase
      .from('tasks')
      .select('id, project_id, version, title, status_id, priority, due_date')
      .eq('id', taskId)
      .eq('is_deleted', false)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found' }, { status: 404 });
    }

    // Optimistic locking check
    if (validated.version !== undefined && validated.version !== existing.version) {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: 'The task was modified by another user. Please reload the task before saving.',
          currentVersion: existing.version,
        },
        { status: 409 }
      );
    }

    const updatePayload: Record<string, any> = {
      version: existing.version + 1,
      updated_at: new Date().toISOString(),
    };

    if (validated.title !== undefined) updatePayload.title = validated.title;
    if (validated.description !== undefined) updatePayload.description = validated.description;
    if (validated.statusId !== undefined) updatePayload.status_id = validated.statusId;
    if (validated.priority !== undefined) updatePayload.priority = validated.priority;
    if (validated.dueDate !== undefined) updatePayload.due_date = validated.dueDate;
    if (validated.position !== undefined) updatePayload.position = validated.position;

    const { data: updated, error: updateError } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    // Update assignees if provided
    if (validated.assigneeIds !== undefined) {
      const canAssign = await checkUserPermission(user.id, 'task.assign');
      const canSelfAssign = await checkUserPermission(user.id, 'task.self_assign');

      if (!canAssign && !canSelfAssign) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Missing task.assign or task.self_assign permission.' },
          { status: 403 }
        );
      }

      const { data: existingAssignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', taskId);

      const existingIds = (existingAssignees || []).map((a: any) => a.user_id);

      if (!canAssign && canSelfAssign) {
        const addedOther = validated.assigneeIds.some((id) => id !== user.id && !existingIds.includes(id));
        const removedOther = existingIds.some((id) => id !== user.id && !validated.assigneeIds!.includes(id));

        if (addedOther || removedOther) {
          return NextResponse.json(
            { error: 'FORBIDDEN', message: 'You only have self-assignment permissions and cannot assign or unassign other team members.' },
            { status: 403 }
          );
        }
      }

      for (const aId of validated.assigneeIds) {
        const isAssignable = await checkUserPermission(aId, 'task.assignable');
        if (!isAssignable) {
          return NextResponse.json(
            { error: 'USER_NOT_ASSIGNABLE', message: 'One or more assignees do not hold the task.assignable permission.' },
            { status: 400 }
          );
        }
      }

      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (validated.assigneeIds.length > 0) {
        const rows = validated.assigneeIds.map((uId) => ({
          task_id: taskId,
          user_id: uId,
        }));
        await supabase.from('task_assignees').insert(rows);
      }
    }

    // Record task activity log
    await supabase.from('task_activity').insert({
      task_id: taskId,
      actor_id: user.id,
      action: 'task.updated',
      details: {
        changes: updatePayload,
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

export async function DELETE(
  _request: NextRequest,
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

    const { data: task, error: fetchErr } = await supabase
      .from('tasks')
      .select('id, project_id, creator_id, title, task_key')
      .eq('id', taskId)
      .eq('is_deleted', false)
      .single();

    if (fetchErr || !task) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found' }, { status: 404 });
    }

    // Check permissions: task.delete or (task.delete_own if creator)
    const canDeleteAll = await checkUserPermission(user.id, 'task.delete');
    const canDeleteOwn = await checkUserPermission(user.id, 'task.delete_own');
    const isOwner = task.creator_id === user.id;

    if (!canDeleteAll && (!canDeleteOwn || !isOwner)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Permission denied to delete this task' }, { status: 403 });
    }

    // Perform soft delete
    const { error: delError } = await supabase
      .from('tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (delError) {
      return NextResponse.json({ error: 'DELETE_FAILED', message: delError.message }, { status: 500 });
    }

    // Record activity and audit
    await supabase.from('task_activity').insert({
      task_id: taskId,
      actor_id: user.id,
      action: 'task.deleted',
      details: { taskKey: task.task_key, title: task.title },
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'task.delete',
      entity: 'task',
      entityId: taskId,
      metadata: { taskKey: task.task_key, title: task.title, projectId: task.project_id },
    });

    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
