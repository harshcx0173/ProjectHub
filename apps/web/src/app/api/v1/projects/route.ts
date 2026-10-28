import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createProjectSchema } from '@project-hub/shared';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

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

    // Fetch authorized projects with user preferences
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        key,
        description,
        icon_type,
        icon_value,
        color,
        group_id,
        is_archived,
        created_at,
        updated_at,
        user_project_prefs!left(is_pinned, last_opened_at)
      `)
      .order('name');

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const formattedProjects = (projects || []).map((p: any) => {
      const prefs = Array.isArray(p.user_project_prefs)
        ? p.user_project_prefs[0]
        : p.user_project_prefs;

      return {
        id: p.id,
        name: p.name,
        key: p.key,
        description: p.description,
        iconType: p.icon_type,
        iconValue: p.icon_value,
        color: p.color,
        groupId: p.group_id,
        isArchived: p.is_archived,
        isPinned: Boolean(prefs?.is_pinned),
        lastOpenedAt: prefs?.last_opened_at || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    return NextResponse.json({ projects: formattedProjects });
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
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'You do not have permission to create projects.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_FAILED', details: parsed.error.errors }, { status: 400 });
    }

    const { name, key, description, groupId, color, iconType, iconValue } = parsed.data;

    // Insert project
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        name,
        key: key.toUpperCase(),
        description: description || null,
        group_id: groupId || null,
        color,
        icon_type: iconType,
        icon_value: iconValue,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'KEY_EXISTS', message: `Project key '${key}' is already in use. Please choose another.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'INSERT_FAILED', message: insertError.message }, { status: 500 });
    }

    // Automatically add creator as project member with Manager role
    await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: user.id,
      project_role: 'Manager',
      added_by: user.id,
    });

    // Record audit log
    await recordAuditLog({
      actorId: user.id,
      action: 'PROJECT_CREATED',
      entity: 'project',
      entityId: project.id,
      metadata: { name, key: project.key, groupId },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 });
  }
}
