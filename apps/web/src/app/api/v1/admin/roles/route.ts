import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { DEFAULT_ROLE_PERMISSIONS, LOCKED_ROLE_PERMISSIONS } from '@project-hub/shared';

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

    const hasAdminPerm = await checkUserPermission(user.id, 'org.roles.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.roles.manage permission' }, { status: 403 });
    }

    // 1. Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name, is_system, is_locked, description, created_at')
      .order('is_system', { ascending: false });

    if (rolesError) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: rolesError.message }, { status: 500 });
    }

    // 2. Fetch permissions catalog
    const { data: permissions, error: permError } = await supabase
      .from('permissions')
      .select('id, key, scope, group_name, label, description, is_assignable')
      .order('group_name');

    if (permError) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: permError.message }, { status: 500 });
    }

    // 3. Fetch role_permissions mappings
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id');

    // 4. Fetch user counts per role
    const { data: profiles } = await supabase
      .from('profiles')
      .select('org_role');

    const roleUserCounts: Record<string, number> = {};
    for (const p of profiles || []) {
      if (p.org_role) {
        roleUserCounts[p.org_role] = (roleUserCounts[p.org_role] || 0) + 1;
      }
    }

    const rolesWithCounts = (roles || []).map((r) => ({
      ...r,
      userCount: roleUserCounts[r.name] || 0,
    }));

    return NextResponse.json({
      roles: rolesWithCounts,
      permissions: permissions || [],
      rolePermissions: rolePerms || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
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

    const hasAdminPerm = await checkUserPermission(user.id, 'org.roles.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.roles.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, permissionIds } = body;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Role name is required' }, { status: 400 });
    }

    // Verify non-assignable/locked permissions are NOT selected
    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      const { data: forbiddenPerms } = await supabase
        .from('permissions')
        .select('key')
        .in('id', permissionIds)
        .or(`is_assignable.eq.false,key.in.(${LOCKED_ROLE_PERMISSIONS.map((k) => `"${k}"`).join(',')})`);

      if (forbiddenPerms && forbiddenPerms.length > 0) {
        return NextResponse.json(
          {
            error: 'LOCKED_PERMISSION',
            message: `Permissions [${forbiddenPerms.map((p) => p.key).join(', ')}] are locked administrative permissions and can only be assigned to Admin.`,
          },
          { status: 400 }
        );
      }
    }

    // Insert custom role
    const { data: role, error: roleInsertError } = await supabase
      .from('roles')
      .insert({
        name: trimmedName,
        description: description || null,
        is_system: false,
        is_locked: false,
      })
      .select()
      .single();

    if (roleInsertError) {
      return NextResponse.json({ error: 'CREATE_FAILED', message: roleInsertError.message }, { status: 500 });
    }

    // Insert permissions mappings
    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      const rows = permissionIds.map((pId) => ({
        role_id: role.id,
        permission_id: pId,
      }));
      await supabase.from('role_permissions').insert(rows);
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'role.create_custom',
      entity: 'role',
      entityId: role.id,
      metadata: { name: trimmedName, permissionCount: permissionIds?.length || 0 },
    });

    return NextResponse.json({ role }, { status: 201 });
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

    const hasAdminPerm = await checkUserPermission(user.id, 'org.roles.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.roles.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { roleId, permissionIds, isResetToDefault, name, description } = body;

    if (!roleId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'roleId is required' }, { status: 400 });
    }

    // Fetch existing role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name, is_system, is_locked, description')
      .eq('id', roleId)
      .single();

    if (roleError || !role) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Role not found' }, { status: 404 });
    }

    // Admin role is completely locked
    if (role.name === 'Admin' || role.is_locked) {
      return NextResponse.json(
        { error: 'ROLE_LOCKED', message: 'The Admin role is immutable and its permissions cannot be modified.' },
        { status: 403 }
      );
    }

    // System roles cannot be renamed
    if (role.is_system && name && name !== role.name) {
      return NextResponse.json(
        { error: 'SYSTEM_ROLE_IMMUTABLE', message: 'System role names cannot be altered.' },
        { status: 400 }
      );
    }

    // Determine target permission IDs
    let targetPermIds: string[] = [];

    if (isResetToDefault) {
      if (!role.is_system || !(role.name in DEFAULT_ROLE_PERMISSIONS)) {
        return NextResponse.json(
          { error: 'RESET_NOT_ALLOWED', message: 'Reset to default is only available for default system roles (Manager, Member).' },
          { status: 400 }
        );
      }

      const defaultKeys = DEFAULT_ROLE_PERMISSIONS[role.name as 'Manager' | 'Member'];
      const { data: defaultPerms } = await supabase
        .from('permissions')
        .select('id, key')
        .in('key', defaultKeys);

      targetPermIds = (defaultPerms || []).map((p) => p.id);
    } else if (Array.isArray(permissionIds)) {
      targetPermIds = permissionIds;

      // Verify that NO locked or non-assignable permission is assigned to non-admin
      if (targetPermIds.length > 0) {
        const { data: forbiddenPerms } = await supabase
          .from('permissions')
          .select('key')
          .in('id', targetPermIds)
          .or(`is_assignable.eq.false,key.in.(${LOCKED_ROLE_PERMISSIONS.map((k) => `"${k}"`).join(',')})`);

        if (forbiddenPerms && forbiddenPerms.length > 0) {
          return NextResponse.json(
            {
              error: 'LOCKED_PERMISSION',
              message: `Permissions [${forbiddenPerms.map((p) => p.key).join(', ')}] are locked administrative permissions and can only be assigned to Admin.`,
            },
            { status: 400 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Either permissionIds or isResetToDefault is required' },
        { status: 400 }
      );
    }

    // Fetch current permissions to calculate diff
    const { data: currentMappings } = await supabase
      .from('role_permissions')
      .select('permission_id, permissions(key)')
      .eq('role_id', roleId);

    const oldPermKeys = (currentMappings || [])
      .map((m: any) => m.permissions?.key)
      .filter(Boolean);

    // Fetch target permission keys for diff
    const { data: targetPermsData } = await supabase
      .from('permissions')
      .select('id, key')
      .in('id', targetPermIds);

    const newPermKeys = (targetPermsData || []).map((p) => p.key);

    const permissionsAdded = newPermKeys.filter((k) => !oldPermKeys.includes(k));
    const permissionsRemoved = oldPermKeys.filter((k) => !newPermKeys.includes(k));

    // Update role permissions: delete existing and insert new
    await supabase.from('role_permissions').delete().eq('role_id', roleId);

    if (targetPermIds.length > 0) {
      const rows = targetPermIds.map((pId) => ({
        role_id: roleId,
        permission_id: pId,
      }));
      const { error: insertError } = await supabase.from('role_permissions').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: 'UPDATE_FAILED', message: insertError.message }, { status: 500 });
      }
    }

    // Update role metadata (name for custom roles, description for all)
    const roleUpdates: Record<string, any> = {};
    if (!role.is_system && name) roleUpdates.name = name.trim();
    if (description !== undefined) roleUpdates.description = description;

    if (Object.keys(roleUpdates).length > 0) {
      await supabase.from('roles').update(roleUpdates).eq('id', roleId);
    }

    // Find all users belonging to this role to count affected and invalidate sessions
    const { data: affectedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_role', role.name);

    const affectedUserIds = (affectedProfiles || []).map((p) => p.id);

    // Invalidate all active sessions for users with this role immediately
    if (affectedUserIds.length > 0) {
      await supabase
        .from('user_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .in('user_id', affectedUserIds)
        .is('revoked_at', null);
    }

    // Audit log with detailed permission diff
    await recordAuditLog({
      actorId: user.id,
      action: isResetToDefault ? 'role.reset_default' : 'role.permissions_update',
      entity: 'role',
      entityId: roleId,
      metadata: {
        roleName: role.name,
        affectedUserCount: affectedUserIds.length,
        permissionsAdded,
        permissionsRemoved,
        isResetToDefault: Boolean(isResetToDefault),
      },
    });

    return NextResponse.json({
      success: true,
      role: { ...role, ...roleUpdates },
      affectedUserCount: affectedUserIds.length,
      permissionsAdded,
      permissionsRemoved,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasAdminPerm = await checkUserPermission(user.id, 'org.roles.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.roles.manage permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'roleId parameter is required' }, { status: 400 });
    }

    const { data: role, error: fetchErr } = await supabase
      .from('roles')
      .select('id, name, is_system, is_locked')
      .eq('id', roleId)
      .single();

    if (fetchErr || !role) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Role not found' }, { status: 404 });
    }

    if (role.is_system || role.is_locked) {
      return NextResponse.json(
        { error: 'CANNOT_DELETE_SYSTEM_ROLE', message: 'System roles (Admin, Manager, Member) cannot be deleted.' },
        { status: 400 }
      );
    }

    // Check if any users are assigned to this role
    const { count: userCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_role', role.name);

    if ((userCount || 0) > 0) {
      return NextResponse.json(
        {
          error: 'ROLE_IN_USE',
          message: `Cannot delete role "${role.name}" because ${userCount} active users are currently assigned to it. Please reassign them first.`,
        },
        { status: 400 }
      );
    }

    const { error: deleteErr } = await supabase.from('roles').delete().eq('id', roleId);
    if (deleteErr) {
      return NextResponse.json({ error: 'DELETE_FAILED', message: deleteErr.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'role.delete_custom',
      entity: 'role',
      entityId: roleId,
      metadata: { roleName: role.name },
    });

    return NextResponse.json({ success: true, message: `Role "${role.name}" deleted successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
