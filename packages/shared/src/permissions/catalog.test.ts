import { describe, it, expect } from 'vitest';
import {
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  ORG_PERMISSIONS,
  PROJECT_PERMISSIONS,
  SYSTEM_ROLE_ADMIN_PERMISSIONS,
  SYSTEM_ROLE_MANAGER_PERMISSIONS,
  SYSTEM_ROLE_MEMBER_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  LOCKED_ROLE_PERMISSIONS,
} from './catalog';

describe('Permissions Catalog & Role Matrix', () => {
  it('contains all required permissions from the master plan', () => {
    expect(ALL_PERMISSIONS.length).toBe(ORG_PERMISSIONS.length + PROJECT_PERMISSIONS.length);
    for (const key of ALL_PERMISSIONS) {
      expect(PERMISSION_CATALOG[key]).toBeDefined();
      expect(PERMISSION_CATALOG[key].key).toBe(key);
    }
  });

  it('correctly locks sensitive administrative permissions', () => {
    // org.roles.manage is locked to Admin only and not assignable
    expect(PERMISSION_CATALOG['org.roles.manage'].isAssignable).toBe(false);
    expect(PERMISSION_CATALOG['project.edit'].isAssignable).toBe(false);
    expect(PERMISSION_CATALOG['project.archive'].isAssignable).toBe(false);
    expect(PERMISSION_CATALOG['chat.message.delete_any'].isAssignable).toBe(false);
    expect(LOCKED_ROLE_PERMISSIONS).toContain('org.roles.manage');
  });

  it('grants Admin every permission in the catalog', () => {
    expect(SYSTEM_ROLE_ADMIN_PERMISSIONS).toEqual(expect.arrayContaining([...ALL_PERMISSIONS]));
    expect(SYSTEM_ROLE_ADMIN_PERMISSIONS.length).toBe(ALL_PERMISSIONS.length);
  });

  it('strictly limits Manager and Member from locked permissions', () => {
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).not.toContain('org.roles.manage');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).not.toContain('org.settings.manage');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).not.toContain('org.audit.view');

    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).not.toContain('org.roles.manage');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).not.toContain('project.create');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).not.toContain('project.members.manage');
  });

  it('configures granular task assignment permissions', () => {
    expect(PERMISSION_CATALOG['task.assign']).toBeDefined();
    expect(PERMISSION_CATALOG['task.self_assign']).toBeDefined();
    expect(PERMISSION_CATALOG['task.assignable']).toBeDefined();

    // Manager can assign others, self-assign, and be assigned
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.assign');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.self_assign');
    expect(SYSTEM_ROLE_MANAGER_PERMISSIONS).toContain('task.assignable');

    // Member can only self-assign and be assigned, cannot assign others
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).not.toContain('task.assign');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).toContain('task.self_assign');
    expect(SYSTEM_ROLE_MEMBER_PERMISSIONS).toContain('task.assignable');

    // Factory defaults for reset
    expect(DEFAULT_ROLE_PERMISSIONS.Manager).toEqual(SYSTEM_ROLE_MANAGER_PERMISSIONS);
    expect(DEFAULT_ROLE_PERMISSIONS.Member).toEqual(SYSTEM_ROLE_MEMBER_PERMISSIONS);
  });
});
