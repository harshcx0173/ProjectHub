import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Get project_id for this task
  const { data: task } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', taskId)
    .single();

  if (!task) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found' }, { status: 404 });
  }

  // Get attached labels
  const { data: attachedLinks } = await supabase
    .from('task_label_links')
    .select('label_id, task_labels(id, name, color)')
    .eq('task_id', taskId);

  // Get all available labels in project
  const { data: projectLabels } = await supabase
    .from('task_labels')
    .select('id, name, color')
    .eq('project_id', task.project_id);

  const attached = (attachedLinks || []).map((l: any) => l.task_labels).filter(Boolean);

  return NextResponse.json({
    attachedLabels: attached,
    availableLabels: projectLabels || [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json();
  const { labelId, name, color } = body;

  let finalLabelId = labelId;

  if (!finalLabelId && name) {
    // Create new label for project first
    const { data: task } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', taskId)
      .single();

    if (!task) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data: newLabel, error: labelErr } = await supabase
      .from('task_labels')
      .insert({
        project_id: task.project_id,
        name: name.trim(),
        color: color || '#2563EB',
      })
      .select()
      .single();

    if (labelErr) return NextResponse.json({ error: labelErr.message }, { status: 500 });
    finalLabelId = newLabel.id;
  }

  if (!finalLabelId) {
    return NextResponse.json({ error: 'labelId or name is required' }, { status: 400 });
  }

  // Link to task
  const { error: linkErr } = await supabase
    .from('task_label_links')
    .insert({
      task_id: taskId,
      label_id: finalLabelId,
    });

  if (linkErr && !linkErr.message.includes('unique')) {
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, labelId: finalLabelId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const labelId = request.nextUrl.searchParams.get('labelId');
  if (!labelId) {
    return NextResponse.json({ error: 'labelId is required' }, { status: 400 });
  }

  await supabase
    .from('task_label_links')
    .delete()
    .eq('task_id', taskId)
    .eq('label_id', labelId);

  return NextResponse.json({ success: true });
}

