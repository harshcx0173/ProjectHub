import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTaskSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 1. Fetch statuses for this project
    const { data: statuses, error: statusError } = await supabase
      .from('task_statuses')
      .select('id, name, color, position, is_completed')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (statusError) {
      return NextResponse.json({ error: 'STATUS_FETCH_FAILED', message: statusError.message }, { status: 500 });
    }

    // 2. Fetch tasks with assignees and checklists
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
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
        created_at,
        updated_at,
        task_assignees (
          user_id,
          profiles (
            id,
            full_name,
            avatar_url
          )
        ),
        task_checklist_items (
          id,
          is_completed
        ),
        task_comments (
          id,
          created_at,
          author_id
        )
      `)
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('position', { ascending: true });

    if (tasksError) {
      return NextResponse.json({ error: 'TASKS_FETCH_FAILED', message: tasksError.message }, { status: 500 });
    }

    // Transform tasks
    const formattedTasks = (tasks || []).map((t: any) => {
      const assignees = (t.task_assignees || [])
        .map((a: any) => a.profiles)
        .filter(Boolean);

      const checklistItems = t.task_checklist_items || [];
      const checklistTotal = checklistItems.length;
      const checklistCompleted = checklistItems.filter((i: any) => i.is_completed).length;
      const comments = t.task_comments || [];
      const commentsCount = comments.length;
      let latestCommentAt: string | null = null;
      let latestCommentAuthorId: string | null = null;

      if (comments.length > 0) {
        const sorted = [...comments].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        latestCommentAt = sorted[0]?.created_at || null;
        latestCommentAuthorId = sorted[0]?.author_id || null;
      }

      return {
        id: t.id,
        statusId: t.status_id,
        taskNumber: t.task_number,
        taskKey: t.task_key,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.due_date,
        position: t.position,
        version: t.version,
        creatorId: t.creator_id,
        assignees,
        checklistTotal,
        checklistCompleted,
        commentsCount,
        latestCommentAt,
        latestCommentAuthorId,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    });

    const [canAssign, canSelfAssign, canCreate, canEdit, canDelete] = await Promise.all([
      checkUserPermission(user.id, 'task.assign'),
      checkUserPermission(user.id, 'task.self_assign'),
      checkUserPermission(user.id, 'task.create'),
      checkUserPermission(user.id, 'task.edit'),
      checkUserPermission(user.id, 'task.delete'),
    ]);

    return NextResponse.json({
      statuses: statuses || [],
      tasks: formattedTasks,
      currentUserId: user.id,
      userPermissions: {
        canAssign,
        canSelfAssign,
        canCreate,
        canEdit,
        canDelete,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Permission check
    const hasCreatePerm = await checkUserPermission(user.id, 'task.create');
    if (!hasCreatePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing task.create permission' }, { status: 403 });
    }

    const body = await request.json();
    const validated = createTaskSchema.parse({
      ...body,
      projectId,
    });

    // Validate assignee permissions
    if (validated.assigneeIds && validated.assigneeIds.length > 0) {
      const canAssign = await checkUserPermission(user.id, 'task.assign');
      const canSelfAssign = await checkUserPermission(user.id, 'task.self_assign');

      if (!canAssign && !canSelfAssign) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Missing task.assign or task.self_assign permission.' },
          { status: 403 }
        );
      }

      if (!canAssign && canSelfAssign) {
        if (validated.assigneeIds.some((id) => id !== user.id)) {
          return NextResponse.json(
            { error: 'FORBIDDEN', message: 'You only have self-assignment permissions and cannot assign other users.' },
            { status: 403 }
          );
        }
      }

      for (const assigneeId of validated.assigneeIds) {
        const isAssignable = await checkUserPermission(assigneeId, 'task.assignable');
        if (!isAssignable) {
          return NextResponse.json(
            { error: 'USER_NOT_ASSIGNABLE', message: 'One or more selected assignees do not hold the task.assignable permission.' },
            { status: 400 }
          );
        }
      }
    }

    // Get max position in target column
    const { data: posData } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', projectId)
      .eq('status_id', validated.statusId)
      .eq('is_deleted', false)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = posData ? posData.position + 1 : 0;

    // Insert task (task_number & task_key populated by database trigger)
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        status_id: validated.statusId,
        title: validated.title,
        description: validated.description || null,
        priority: validated.priority,
        due_date: validated.dueDate || null,
        position: nextPosition,
        creator_id: user.id,
      })
      .select('id, task_key, task_number, title, status_id, priority, due_date, position, version')
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'TASK_CREATE_FAILED', message: insertError.message }, { status: 500 });
    }

    // Insert assignees if provided
    if (validated.assigneeIds && validated.assigneeIds.length > 0) {
      const assigneeRows = validated.assigneeIds.map((assigneeId) => ({
        task_id: newTask.id,
        user_id: assigneeId,
      }));
      await supabase.from('task_assignees').insert(assigneeRows);
    }

    // Record task activity
    await supabase.from('task_activity').insert({
      task_id: newTask.id,
      actor_id: user.id,
      action: 'task.created',
      details: {
        taskKey: newTask.task_key,
        title: newTask.title,
        priority: newTask.priority,
      },
    });

    // Record audit log
    await recordAuditLog({
      actorId: user.id,
      action: 'task.create',
      entity: 'task',
      entityId: newTask.id,
      metadata: {
        projectId,
        taskKey: newTask.task_key,
        title: newTask.title,
      },
    });

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'VALIDATION_ERROR', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
