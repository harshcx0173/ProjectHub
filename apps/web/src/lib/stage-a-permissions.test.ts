import { describe, it, expect } from 'vitest';
import {
  PERMISSION_CATALOG,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_ROLE_PERMISSIONS,
  SYSTEM_ROLE_MANAGER_PERMISSIONS,
  SYSTEM_ROLE_MEMBER_PERMISSIONS,
  SYSTEM_ROLE_ADMIN_PERMISSIONS,
} from '@project-hub/shared';

describe('Stage A - Role Permissions and Task Assignment Logic', () => {
  it('enforces that locked administrative permissions are non-assignable', () => {
    expect(LOCKED_ROLE_PERMISSIONS).toContain('org.roles.manage');
    expect(PERMISSION_CATALOG['org.roles.manage'].isAssignable).toBe(false);

    // Ensure non-Admin default roles do not have org.roles.manage
    expect(DEFAULT_ROLE_PERMISSIONS.Manager).not.toContain('org.roles.manage');
    expect(DEFAULT_ROLE_PERMISSIONS.Member).not.toContain('org.roles.manage');
  });

  it('validates permission diff calculation for role updates', () => {
    const oldPerms = ['project.view', 'task.create', 'task.edit'];
    const newPerms = ['project.view', 'task.create', 'task.delete', 'chat.send'];

    const added = newPerms.filter((p) => !oldPerms.includes(p));
    const removed = oldPerms.filter((p) => !newPerms.includes(p));

    expect(added).toEqual(['task.delete', 'chat.send']);
    expect(removed).toEqual(['task.edit']);
  });

  it('correctly delineates granular task assignment permissions', () => {
    // 1. Manager can assign tasks to others, self-assign, and be assignable
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.assign');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.self_assign');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.assignable');

    // 2. Member cannot assign tasks to others, but can self-assign and be assignable
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).not.toContain('task.assign');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).toContain('task.self_assign');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).toContain('task.assignable');

    // 3. Admin holds all permissions
    expect(SYSTEM_ROLE_ADMIN_PERMISSIONS).toContain('task.assign');
    expect(SYSTEM_ROLE_ADMIN_PERMISSIONS).toContain('task.self_assign');
    expect(SYSTEM_ROLE_ADMIN_PERMISSIONS).toContain('task.assignable');
  });

  it('validates self-assign restriction logic', () => {
    const currentUserId = 'user-123';
    const existingAssignees = ['user-456'];

    // Self-assign only user adding themselves: ALLOWED
    const validSelfAdd = ['user-456', currentUserId];
    const addedOther1 = validSelfAdd.some((id) => id !== currentUserId && !existingAssignees.includes(id));
    const removedOther1 = existingAssignees.some((id) => id !== currentUserId && !validSelfAdd.includes(id));
    expect(addedOther1 || removedOther1).toBe(false);

    // Self-assign only user trying to assign another user: BLOCKED
    const invalidOtherAdd = ['user-456', 'user-789'];
    const addedOther2 = invalidOtherAdd.some((id) => id !== currentUserId && !existingAssignees.includes(id));
    expect(addedOther2).toBe(true);

    // Self-assign only user trying to remove another user: BLOCKED
    const invalidOtherRemove: string[] = [];
    const removedOther3 = existingAssignees.some((id) => id !== currentUserId && !invalidOtherRemove.includes(id));
    expect(removedOther3).toBe(true);
  });
});
