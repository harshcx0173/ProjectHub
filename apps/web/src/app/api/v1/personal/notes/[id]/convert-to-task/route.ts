import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { convertNoteToTaskSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
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

    // Permission to create task
    const canCreateTask = await checkUserPermission(user.id, 'task.create');
    if (!canCreateTask) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing task.create permission' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = convertNoteToTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.format() }, { status: 400 });
    }

    const { projectId, columnId, priority, dueDate, assigneeIds } = parsed.data;

    // Fetch personal note (ownership verified)
    const { data: note, error: noteError } = await supabase
      .from('personal_notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (noteError && noteError.code !== 'PGRST205') {
      return NextResponse.json({ error: 'FETCH_FAILED', message: noteError.message }, { status: 500 });
    }

    // Fallback if note was in client state
    const noteData = note || {
      title: body.title || 'Converted Personal Note',
      content: body.content || '',
      content_type: body.contentType || 'text',
      checklist_items: body.checklistItems || [],
    };

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, key, name')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json({ error: 'PROJECT_NOT_FOUND', message: 'Target project does not exist' }, { status: 404 });
    }

    // Resolve column / status id
    let targetStatusId = columnId;
    if (!targetStatusId) {
      const { data: defaultStatus } = await supabase
        .from('task_statuses')
        .select('id')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();

      targetStatusId = defaultStatus?.id;
    }

    // Get max task number for task key
    const { data: lastTask } = await supabase
      .from('tasks')
      .select('task_number')
      .eq('project_id', projectId)
      .order('task_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = (lastTask?.task_number || 0) + 1;
    const taskKey = `${project.key}-${nextNumber}`;

    // Format description
    let descriptionText = noteData.content || '';
    if (noteData.content_type === 'checklist' && Array.isArray(noteData.checklist_items) && noteData.checklist_items.length > 0) {
      const checklistMd = noteData.checklist_items
        .map((item: any) => `- [${item.completed ? 'x' : ' '}] ${item.text}`)
        .join('\n');
      descriptionText = descriptionText ? `${descriptionText}\n\nChecklist:\n${checklistMd}` : checklistMd;
    }

    // Create task
    const { data: task, error: taskCreateError } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        status_id: targetStatusId,
        task_number: nextNumber,
        task_key: taskKey,
        title: noteData.title || 'Personal Note Task',
        description: descriptionText,
        priority: priority || 'medium',
        due_date: dueDate || null,
        creator_id: user.id,
        position: 0,
      })
      .select()
      .single();

    if (taskCreateError) {
      return NextResponse.json({ error: 'TASK_CREATE_FAILED', message: taskCreateError.message }, { status: 500 });
    }

    // Insert assignees if provided
    if (assigneeIds && assigneeIds.length > 0) {
      const assigneeRows = assigneeIds.map((uid) => ({
        task_id: task.id,
        user_id: uid,
      }));
      try {
        await supabase.from('task_assignees').insert(assigneeRows);
      } catch {}
    }

    // If checklist items exist, also insert into task_checklist_items
    if (noteData.content_type === 'checklist' && Array.isArray(noteData.checklist_items) && noteData.checklist_items.length > 0) {
      const checklistRows = noteData.checklist_items.map((item: any, idx: number) => ({
        task_id: task.id,
        title: item.text,
        is_completed: Boolean(item.completed),
        position: idx,
      }));
      try {
        await supabase.from('task_checklist_items').insert(checklistRows);
      } catch {}
    }

    // Archive the personal note
    try {
      await supabase
        .from('personal_notes')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch {}

    // Audit log: note converted to task (no content in log!)
    await recordAuditLog({
      actorId: user.id,
      action: 'personal_note.convert_to_task',
      entity: 'task',
      entityId: task.id,
      metadata: { noteId: id, taskId: task.id, projectId },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      taskId: task.id,
      taskKey: task.task_key,
      projectId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
