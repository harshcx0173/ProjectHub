import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

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

    const hasAdminPerm = await checkUserPermission(user.id, 'org.users.view');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.users.view permission' }, { status: 403 });
    }

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, designation, org_role, status, is_totp_enabled, last_seen_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasAdminPerm = await checkUserPermission(user.id, 'org.users.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.users.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, orgRole, status } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'targetUserId is required' }, { status: 400 });
    }

    // Check last Admin protection rule
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, org_role, status')
      .eq('id', targetUserId)
      .single();

    if (targetUser && targetUser.org_role === 'Admin') {
      const { count: activeAdminCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('org_role', 'Admin')
        .eq('status', 'active');

      if ((activeAdminCount || 0) <= 1) {
        if (status === 'disabled' || (orgRole && orgRole !== 'Admin')) {
          return NextResponse.json(
            { error: 'LAST_ADMIN_PROTECTED', message: 'Cannot demote or disable the last active Administrator.' },
            { status: 400 }
          );
        }
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (orgRole) updates.org_role = orgRole;
    if (status) updates.status = status;

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', targetUserId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    // If disabled, immediately revoke all active sessions and reassign or unassign tasks
    if (status === 'disabled') {
      await supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('user_id', targetUserId);

      const { reassignToUserId, unassignTasks } = body;
      if (reassignToUserId) {
        // Reassign open tasks to the designated user
        await supabase
          .from('task_assignees')
          .update({ user_id: reassignToUserId })
          .eq('user_id', targetUserId);
      } else if (unassignTasks) {
        // Remove user from all assigned tasks
        await supabase
          .from('task_assignees')
          .delete()
          .eq('user_id', targetUserId);
      }
    }

    await recordAuditLog({
      actorId: user.id,
      action: status === 'disabled' ? 'user.disable' : 'user.role_change',
      entity: 'profile',
      entityId: targetUserId,
      metadata: { ...updates, reassignToUserId: body.reassignToUserId, unassignTasks: body.unassignTasks },
    });

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
