import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Fetch tasks where the user is an assignee
    const { data: myTasks, error } = await supabase
      .from('task_assignees')
      .select(`
        task_id,
        tasks (
          id,
          project_id,
          status_id,
          task_number,
          task_key,
          title,
          priority,
          due_date,
          position,
          version,
          created_at,
          updated_at,
          projects (
            id,
            name,
            key,
            color,
            icon_value
          ),
          task_statuses (
            id,
            name,
            color,
            is_completed
          ),
          task_checklist_items (
            id,
            is_completed
          ),
          task_comments (
            id
          )
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const formattedTasks = (myTasks || [])
      .map((item: any) => item.tasks)
      .filter((t: any) => t && !t.is_deleted)
      .map((t: any) => {
        const checklistItems = t.task_checklist_items || [];
        return {
          id: t.id,
          projectId: t.project_id,
          project: t.projects,
          statusId: t.status_id,
          status: t.task_statuses,
          taskKey: t.task_key,
          title: t.title,
          priority: t.priority,
          dueDate: t.due_date,
          checklistTotal: checklistItems.length,
          checklistCompleted: checklistItems.filter((i: any) => i.is_completed).length,
          commentsCount: (t.task_comments || []).length,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        };
      })
      .sort((a: any, b: any) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

    return NextResponse.json({ tasks: formattedTasks });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
