import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProjectGroupSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: groups, error } = await supabase
      .from('project_groups')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ groups: groups || [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Check project.create permission
    const hasCreatePerm = await checkUserPermission(user.id, 'project.create');
    if (!hasCreatePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Permission denied.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createProjectGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: parsed.error.errors }, { status: 400 });
    }

    const { name, position } = parsed.data;

    const { data: newGroup, error: insertError } = await supabase
      .from('project_groups')
      .insert({ name, position })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'INSERT_FAILED', message: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, group: newGroup }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
