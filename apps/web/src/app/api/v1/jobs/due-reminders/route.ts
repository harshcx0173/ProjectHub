import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // Validate authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Invalid cron secret' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const now = new Date();
  const next24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Find non-deleted tasks due within the next 24 hours
  const { data: upcomingTasks, error } = await adminClient
    .from('tasks')
    .select(`
      id,
      title,
      due_date,
      project_id,
      task_assignees (
        user_id
      )
    `)
    .not('due_date', 'is', null)
    .gte('due_date', now.toISOString())
    .lte('due_date', next24h.toISOString())
    .eq('is_deleted', false);

  if (error) {
    return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
  }

  let notificationsCreated = 0;

  for (const task of upcomingTasks || []) {
    const assignees = task.task_assignees || [];
    for (const a of assignees) {
      // Check if notification already exists for this task today
      const { data: existing } = await adminClient
        .from('notifications')
        .select('id')
        .eq('user_id', a.user_id)
        .eq('type', 'task_due_soon')
        .eq('entity_id', task.id)
        .maybeSingle();

      if (!existing) {
        await adminClient.from('notifications').insert({
          user_id: a.user_id,
          type: 'task_due_soon',
          title: `Task Due Soon: ${task.title}`,
          content: `Your assigned task is due on ${new Date(task.due_date).toLocaleDateString()}.`,
          entity_id: task.id,
          project_id: task.project_id,
        });
        notificationsCreated++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    tasksChecked: upcomingTasks?.length || 0,
    notificationsCreated,
    timestamp: new Date().toISOString(),
  });
}

