import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    return NextResponse.json({ members: formatted });
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

    const { data: newMember, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        project_role: projectRole,
      })
      .select()
      .single();

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
