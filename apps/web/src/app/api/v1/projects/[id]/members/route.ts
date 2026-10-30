import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkUserPermission } from '@/lib/permissions';
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

    const canManageMembers = await checkUserPermission(user.id, 'project.members.manage');

    const { data: members, error } = await supabase
      .from('project_members')
      .select(`
        id,
        project_id,
        user_id,
        project_role,
        created_at,
        profiles!user_id (
          id,
          full_name,
          avatar_url,
          designation,
          org_role
        )
      `)
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    // Check assignability and open task counts
    const formatted = await Promise.all(
      (members || []).map(async (m: any) => {
        const isAssignable = await checkUserPermission(m.user_id, 'task.assignable');

        const { count: openTaskCount } = await supabase
          .from('task_assignees')
          .select('task_id, tasks!inner(id, project_id, is_deleted)', { count: 'exact', head: true })
          .eq('user_id', m.user_id)
          .eq('tasks.project_id', projectId)
          .eq('tasks.is_deleted', false);

        return {
          id: m.id,
          projectId: m.project_id,
          userId: m.user_id,
          projectRole: m.project_role,
          fullName: m.profiles?.full_name || 'Member',
          avatarUrl: m.profiles?.avatar_url || null,
          designation: m.profiles?.designation || null,
          orgRole: m.profiles?.org_role || 'Member',
          isAssignable,
          openTaskCount: openTaskCount || 0,
          createdAt: m.created_at,
        };
      })
    );

    // Fetch candidate users not yet in this project and all dynamic roles
    const currentMemberIds = (members || []).map((m: any) => m.user_id);
    let availableUsersQuery = supabase
      .from('profiles')
      .select('id, full_name, avatar_url, designation, org_role')
      .eq('status', 'active')
      .order('full_name');

    if (currentMemberIds.length > 0) {
      availableUsersQuery = availableUsersQuery.not('id', 'in', `(${currentMemberIds.join(',')})`);
    }

    const [{ data: availableUsers }, { data: availableRoles }] = await Promise.all([
      availableUsersQuery,
      supabase
        .from('roles')
        .select('id, name, is_system, is_locked, description')
        .order('is_system', { ascending: false })
        .order('name', { ascending: true }),
    ]);

    return NextResponse.json({
      members: formatted,
      canManageMembers,
      availableUsers: (availableUsers || []).map((u: any) => ({
        id: u.id,
        fullName: u.full_name || 'Member',
        avatarUrl: u.avatar_url || null,
        designation: u.designation || null,
        orgRole: u.org_role || 'Member',
      })),
      availableRoles: (availableRoles || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        isSystem: r.is_system,
        description: r.description,
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
    const { id: projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const canManageMembers = await checkUserPermission(user.id, 'project.members.manage');
    if (!canManageMembers) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing project.members.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, projectRole = 'Member' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'userId is required' }, { status: 400 });
    }

    // Verify user exists and is active
    const { data: targetProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !targetProfile) {
      return NextResponse.json({ error: 'USER_NOT_FOUND', message: 'User does not exist.' }, { status: 404 });
    }

    if (targetProfile.status === 'disabled') {
      return NextResponse.json({ error: 'USER_DISABLED', message: 'Cannot add a disabled user to a project.' }, { status: 400 });
    }

    // Verify role exists
    const { data: roleExists } = await supabase
      .from('roles')
      .select('name')
      .eq('name', projectRole)
      .maybeSingle();

    if (!roleExists) {
      return NextResponse.json({ error: 'INVALID_ROLE', message: `Role '${projectRole}' does not exist.` }, { status: 400 });
    }

    // Verify if already in project
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: 'ALREADY_EXISTS', message: 'This user is already a member of this project.' },
        { status: 409 }
      );
    }

    const { data: newMember, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        project_role: projectRole,
        added_by: user.id,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      return NextResponse.json({ error: 'ADD_MEMBER_FAILED', message: insertError.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'project.member.add',
      entity: 'project',
      entityId: projectId,
      metadata: { targetUserId: userId, projectRole },
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
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

    const canManageMembers = await checkUserPermission(user.id, 'project.members.manage');
    if (!canManageMembers) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing project.members.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, projectRole } = body;

    if (!userId || !projectRole) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'userId and projectRole are required' }, { status: 400 });
    }

    // Verify role exists
    const { data: roleExists } = await supabase
      .from('roles')
      .select('name')
      .eq('name', projectRole)
      .maybeSingle();

    if (!roleExists) {
      return NextResponse.json({ error: 'INVALID_ROLE', message: `Role '${projectRole}' does not exist.` }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: updatedMember, error: updateError } = await adminSupabase
      .from('project_members')
      .update({ project_role: projectRole })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'project.member.role_change',
      entity: 'project',
      entityId: projectId,
      metadata: { targetUserId: userId, newRole: projectRole },
    });

    return NextResponse.json({ member: updatedMember });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(
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

    const canManageMembers = await checkUserPermission(user.id, 'project.members.manage');
    if (!canManageMembers) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing project.members.manage permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const reassignToUserId = searchParams.get('reassignToUserId');
    const unassignTasks = searchParams.get('unassignTasks') === 'true';

    if (!targetUserId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'userId query parameter is required' }, { status: 400 });
    }

    // 1. Fetch assigned open tasks for this member in this project
    const { data: memberTaskAssignees } = await supabase
      .from('task_assignees')
      .select('task_id, tasks!inner(id, project_id, is_deleted)')
      .eq('user_id', targetUserId)
      .eq('tasks.project_id', projectId)
      .eq('tasks.is_deleted', false);

    const taskIds = (memberTaskAssignees || []).map((m: any) => m.task_id);

    // 2. Handle task reassignment or unassigning
    if (taskIds.length > 0) {
      if (reassignToUserId) {
        // Remove targetUserId from tasks
        await supabase
          .from('task_assignees')
          .delete()
          .eq('user_id', targetUserId)
          .in('task_id', taskIds);

        // Add reassignToUserId to those tasks
        for (const tId of taskIds) {
          await supabase
            .from('task_assignees')
            .upsert({ task_id: tId, user_id: reassignToUserId }, { onConflict: 'task_id, user_id' });
        }
      } else if (unassignTasks) {
        await supabase
          .from('task_assignees')
          .delete()
          .eq('user_id', targetUserId)
          .in('task_id', taskIds);
      }
    }

    // 3. Remove from project_members
    const { error: removeError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', targetUserId);

    if (removeError) {
      return NextResponse.json({ error: 'REMOVE_FAILED', message: removeError.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'project.member.remove',
      entity: 'project',
      entityId: projectId,
      metadata: {
        removedUserId: targetUserId,
        reassignedToUserId: reassignToUserId || null,
        tasksReassignedCount: taskIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from project successfully',
      tasksAffectedCount: taskIds.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
