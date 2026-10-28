import { describe, it, expect } from 'vitest';
import {
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  ORG_PERMISSIONS,
  PROJECT_PERMISSIONS,
  SYSTEM_ROLE_ADMIN_PERMISSIONS,
  SYSTEM_ROLE_MANAGER_PERMISSIONS,
  SYSTEM_ROLE_MEMBER_PERMISSIONS,
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
});
