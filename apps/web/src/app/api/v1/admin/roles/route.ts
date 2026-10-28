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
      .select('id, key, scope, group_name, is_assignable')
      .order('group_name');

    if (permError) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: permError.message }, { status: 500 });
    }

    // 3. Fetch role_permissions mappings
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('role_id, permission_id');

    return NextResponse.json({
      roles: roles || [],
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
        .eq('is_assignable', false);

      if (forbiddenPerms && forbiddenPerms.length > 0) {
        return NextResponse.json(
          {
            error: 'LOCKED_PERMISSION',
            message: `Permissions [${forbiddenPerms.map((p) => p.key).join(', ')}] are locked system permissions and cannot be assigned to custom roles.`,
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
