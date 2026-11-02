import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createTaskCommentSchema } from '@project-hub/shared';

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

    const { data: comments, error } = await supabase
      .from('task_comments')
      .select(`
        id,
        content,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          avatar_url,
          designation
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      comments: (comments || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        author: c.profiles,
      })),
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
    const { id: taskId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createTaskCommentSchema.parse({
      ...body,
      taskId,
    });

    // Check task access
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, project_id, title, task_key')
      .eq('id', taskId)
      .eq('is_deleted', false)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Task not found or access denied' }, { status: 404 });
    }

    // Insert comment
    const { data: comment, error: insertErr } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        author_id: user.id,
        content: validated.content.trim(),
      })
      .select(`
        id,
        content,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          avatar_url,
          designation
        )
      `)
      .single();

    if (insertErr) {
      return NextResponse.json({ error: 'COMMENT_FAILED', message: insertErr.message }, { status: 500 });
    }

    // Record activity and notify assignees concurrently
    await Promise.allSettled([
      supabase.from('task_activity').insert({
        task_id: taskId,
        actor_id: user.id,
        action: 'task.commented',
        details: { commentId: comment.id },
      }),
      (async () => {
        const { data: assignees } = await supabase
          .from('task_assignees')
          .select('user_id')
          .eq('task_id', taskId)
          .neq('user_id', user.id);

        if (assignees && assignees.length > 0) {
          const notifs = assignees.map((a: any) => ({
            user_id: a.user_id,
            actor_id: user.id,
            type: 'task_comment',
            title: `New comment on ${task.task_key}`,
            body: validated.content.slice(0, 100),
            link_url: `/projects/${task.project_id}/board?task=${task.id}`,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      })(),
    ]);

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        author: comment.profiles,
      },
    }, { status: 201 });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'VALIDATION_ERROR', issues: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
