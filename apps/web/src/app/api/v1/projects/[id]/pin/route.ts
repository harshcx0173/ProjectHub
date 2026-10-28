import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const body = await request.json();
    const isPinned = Boolean(body.isPinned);

    // Upsert preference
    const { error: upsertError } = await supabase
      .from('user_project_prefs')
      .upsert(
        {
          user_id: user.id,
          project_id: projectId,
          is_pinned: isPinned,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, project_id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: 'PREF_FAILED', message: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, projectId, isPinned });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
