import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const { data: project, error: fetchErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (fetchErr || !project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.org_role === 'Admin';

    return NextResponse.json({
      project,
      isAdmin,
      userRole: profile?.org_role || 'Member',
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}

export async function PATCH(
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

    // Check user profile for Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.org_role === 'Admin';

    // If request contains admin-only fields, check admin rights
    const hasAdminFields =
      body.iconType !== undefined ||
      body.iconValue !== undefined ||
      body.color !== undefined ||
      body.isArchived !== undefined;

    if (hasAdminFields && !isAdmin) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Permission denied: Only Administrators can modify project icons, colors, or archive status.',
        },
        { status: 403 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.groupId !== undefined) updates.group_id = body.groupId;

    if (isAdmin) {
      if (body.iconType !== undefined) updates.icon_type = body.iconType;
      if (body.iconValue !== undefined) updates.icon_value = body.iconValue;
      if (body.color !== undefined) updates.color = body.color;
      if (body.isArchived !== undefined) updates.is_archived = body.isArchived;
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'PROJECT_UPDATED',
      entity: 'project',
      entityId: projectId,
      metadata: updates,
    });

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
