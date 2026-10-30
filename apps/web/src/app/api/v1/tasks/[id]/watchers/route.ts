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

  const { data: watchers, error } = await supabase
    .from('task_watchers')
    .select('user_id, created_at, profiles(id, full_name, avatar_url)')
    .eq('task_id', taskId);

  if (error) {
    return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
  }

  const isWatching = watchers?.some((w) => w.user_id === user.id) || false;

  return NextResponse.json({
    watchers: watchers || [],
    isWatching,
    watcherCount: watchers?.length || 0,
  });
}

export async function POST(
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

  // Check if currently watching
  const { data: existing } = await supabase
    .from('task_watchers')
    .select('task_id')
    .eq('task_id', taskId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    // Unwatch
    await supabase
      .from('task_watchers')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', user.id);

    return NextResponse.json({ isWatching: false });
  } else {
    // Watch
    await supabase.from('task_watchers').insert({
      task_id: taskId,
      user_id: user.id,
    });

    return NextResponse.json({ isWatching: true });
  }
}

