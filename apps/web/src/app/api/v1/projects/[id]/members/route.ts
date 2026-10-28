import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: members, error } = await supabase
      .from('project_members')
      .select(`
        id,
        project_id,
        user_id,
        project_role,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url,
          designation
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const formatted = (members || []).map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      projectRole: m.project_role,
      fullName: m.profiles?.full_name || 'Member',
      avatarUrl: m.profiles?.avatar_url || null,
      designation: m.profiles?.designation || null,
      createdAt: m.created_at,
    }));

    return NextResponse.json({ members: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
