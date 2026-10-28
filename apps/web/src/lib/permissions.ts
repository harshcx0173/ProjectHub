import { PermissionKey } from '@project-hub/shared';
import { createClient } from './supabase/server';

/**
 * Checks if a user has a specific permission key.
 * Queries public.has_permission(uid, key) in Postgres.
 */
export async function checkUserPermission(
  userId: string,
  permissionKey: PermissionKey
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('has_permission', {
    p_user_id: userId,
    p_permission_key: permissionKey,
  });

  if (error || !data) {
    return false;
  }

  return Boolean(data);
}

/**
 * In-memory permission check for frontend components and hooks.
 */
export function hasPermission(
  userPermissions: string[] | undefined,
  permission: PermissionKey
): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(permission);
}
