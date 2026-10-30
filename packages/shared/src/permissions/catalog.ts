/**
 * Project Hub - Single Source of Truth for Permissions and Roles
 * As defined in PROJECT_PLAN.md Section 5
 */

export const ORG_PERMISSIONS = [
  'org.settings.manage',
  'org.users.view',
  'org.users.manage',
  'org.users.disable',
  'org.invitations.manage',
  'org.roles.manage', // Locked: Admin only, non-assignable
  'org.audit.view',
  'project.create',
] as const;

export const PROJECT_PERMISSIONS = [
  'project.view',
  'project.edit', // name, description, icon, color (Admin only in plan)
  'project.archive', // Admin only in plan
  'project.members.manage',
  'project.settings.manage',
  'task.create',
  'task.edit',
  'task.assign',
  'task.self_assign',
  'task.assignable',
  'task.delete',
  'task.delete_own',
  'chat.read',
  'chat.send',
  'chat.message.edit_own',
  'chat.message.delete_own',
  'chat.message.delete_any',
  'chat.message.pin',
  'file.upload',
  'file.delete_own',
  'file.delete_any',
] as const;

export const ALL_PERMISSIONS = [...ORG_PERMISSIONS, ...PROJECT_PERMISSIONS] as const;

export type OrgPermissionKey = (typeof ORG_PERMISSIONS)[number];
export type ProjectPermissionKey = (typeof PROJECT_PERMISSIONS)[number];
export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export interface PermissionDefinition {
  key: PermissionKey;
  scope: 'org' | 'project';
  group: 'settings' | 'users' | 'invitations' | 'roles' | 'audit' | 'project' | 'task' | 'chat' | 'file';
  label: string;
  description: string;
  isAssignable: boolean; // false for locked permissions like org.roles.manage
}

export const PERMISSION_CATALOG: Record<PermissionKey, PermissionDefinition> = {
  // Organization Scope
  'org.settings.manage': {
    key: 'org.settings.manage',
    scope: 'org',
    group: 'settings',
    label: 'Manage Organization Settings',
    description: 'Update organization name, logo, working days, and timezone',
    isAssignable: false,
  },
  'org.users.view': {
    key: 'org.users.view',
    scope: 'org',
    group: 'users',
    label: 'View Users',
    description: 'View the organization member directory',
    isAssignable: false,
  },
  'org.users.manage': {
    key: 'org.users.manage',
    scope: 'org',
    group: 'users',
    label: 'Manage Users',
    description: 'Change user roles and reassign tasks during offboarding',
    isAssignable: false,
  },
  'org.users.disable': {
    key: 'org.users.disable',
    scope: 'org',
    group: 'users',
    label: 'Disable Users',
    description: 'Deactivate user accounts and revoke all active sessions',
    isAssignable: false,
  },
  'org.invitations.manage': {
    key: 'org.invitations.manage',
    scope: 'org',
    group: 'invitations',
    label: 'Manage Invitations',
    description: 'Invite new users, resend, revoke, and copy invite links',
    isAssignable: false,
  },
  'org.roles.manage': {
    key: 'org.roles.manage',
    scope: 'org',
    group: 'roles',
    label: 'Manage Roles',
    description: 'Create and configure custom roles (Admin locked)',
    isAssignable: false,
  },
  'org.audit.view': {
    key: 'org.audit.view',
    scope: 'org',
    group: 'audit',
    label: 'View Audit Logs',
    description: 'View administrative and security audit trail',
    isAssignable: false,
  },
  'project.create': {
    key: 'project.create',
    scope: 'org',
    group: 'project',
    label: 'Create Project',
    description: 'Create new projects and project groups',
    isAssignable: true,
  },

  // Project Scope
  'project.view': {
    key: 'project.view',
    scope: 'project',
    group: 'project',
    label: 'View Project',
    description: 'Access project workspace, board, chat, and files',
    isAssignable: true,
  },
  'project.edit': {
    key: 'project.edit',
    scope: 'project',
    group: 'project',
    label: 'Edit Project Info & Icon',
    description: 'Edit project name, description, color, and icon (Admin only)',
    isAssignable: false,
  },
  'project.archive': {
    key: 'project.archive',
    scope: 'project',
    group: 'project',
    label: 'Archive Project',
    description: 'Archive or restore projects (Admin only)',
    isAssignable: false,
  },
  'project.members.manage': {
    key: 'project.members.manage',
    scope: 'project',
    group: 'project',
    label: 'Manage Project Members',
    description: 'Add or remove members from projects',
    isAssignable: true,
  },
  'project.settings.manage': {
    key: 'project.settings.manage',
    scope: 'project',
    group: 'project',
    label: 'Manage Project Settings',
    description: 'Configure project columns and preferences',
    isAssignable: true,
  },
  'task.create': {
    key: 'task.create',
    scope: 'project',
    group: 'task',
    label: 'Create Tasks',
    description: 'Create new tasks in project columns',
    isAssignable: true,
  },
  'task.edit': {
    key: 'task.edit',
    scope: 'project',
    group: 'task',
    label: 'Edit Tasks',
    description: 'Edit task titles, descriptions, due dates, and checklist items',
    isAssignable: true,
  },
  'task.assign': {
    key: 'task.assign',
    scope: 'project',
    group: 'task',
    label: 'Assign Tasks to Others',
    description: 'Assign or reassign tasks to team members',
    isAssignable: true,
  },
  'task.self_assign': {
    key: 'task.self_assign',
    scope: 'project',
    group: 'task',
    label: 'Self-Assign Tasks',
    description: 'Assign or unassign oneself to tasks',
    isAssignable: true,
  },
  'task.assignable': {
    key: 'task.assignable',
    scope: 'project',
    group: 'task',
    label: 'Assignable to Tasks',
    description: 'Permit this role to be selected as a task assignee',
    isAssignable: true,
  },
  'task.delete': {
    key: 'task.delete',
    scope: 'project',
    group: 'task',
    label: 'Delete Any Task',
    description: 'Delete tasks created by any member',
    isAssignable: true,
  },
  'task.delete_own': {
    key: 'task.delete_own',
    scope: 'project',
    group: 'task',
    label: 'Delete Own Tasks',
    description: 'Delete tasks created by yourself',
    isAssignable: true,
  },
  'chat.read': {
    key: 'chat.read',
    scope: 'project',
    group: 'chat',
    label: 'Read Project Chat',
    description: 'Read realtime messages and threads in project channels',
    isAssignable: true,
  },
  'chat.send': {
    key: 'chat.send',
    scope: 'project',
    group: 'chat',
    label: 'Send Project Messages',
    description: 'Post messages, replies, mentions, and icon reactions',
    isAssignable: true,
  },
  'chat.message.edit_own': {
    key: 'chat.message.edit_own',
    scope: 'project',
    group: 'chat',
    label: 'Edit Own Messages',
    description: 'Edit your own sent messages',
    isAssignable: true,
  },
  'chat.message.delete_own': {
    key: 'chat.message.delete_own',
    scope: 'project',
    group: 'chat',
    label: 'Delete Own Messages',
    description: 'Delete your own sent messages',
    isAssignable: true,
  },
  'chat.message.delete_any': {
    key: 'chat.message.delete_any',
    scope: 'project',
    group: 'chat',
    label: 'Moderation: Delete Any Message',
    description: 'Delete any message in the channel',
    isAssignable: false,
  },
  'chat.message.pin': {
    key: 'chat.message.pin',
    scope: 'project',
    group: 'chat',
    label: 'Pin Messages',
    description: 'Pin important messages to channel header',
    isAssignable: true,
  },
  'file.upload': {
    key: 'file.upload',
    scope: 'project',
    group: 'file',
    label: 'Upload Files',
    description: 'Upload files and attachments in chat and tasks',
    isAssignable: true,
  },
  'file.delete_own': {
    key: 'file.delete_own',
    scope: 'project',
    group: 'file',
    label: 'Delete Own Files',
    description: 'Delete files uploaded by yourself',
    isAssignable: true,
  },
  'file.delete_any': {
    key: 'file.delete_any',
    scope: 'project',
    group: 'file',
    label: 'Delete Any File',
    description: 'Delete any file in the project',
    isAssignable: false,
  },
};

/**
 * System Roles and their assigned default permissions
 * Based on Section 5.2 Permission Matrix
 */
export const SYSTEM_ROLE_ADMIN_PERMISSIONS: PermissionKey[] = [...ALL_PERMISSIONS];

export const SYSTEM_ROLE_MANAGER_PERMISSIONS: PermissionKey[] = [
  'project.create',
  'project.view',
  'project.members.manage',
  'project.settings.manage',
  'task.create',
  'task.edit',
  'task.assign',
  'task.self_assign',
  'task.assignable',
  'task.delete',
  'task.delete_own',
  'chat.read',
  'chat.send',
  'chat.message.edit_own',
  'chat.message.delete_own',
  'chat.message.delete_any',
  'chat.message.pin',
  'file.upload',
  'file.delete_own',
  'file.delete_any',
];

export const SYSTEM_ROLE_MEMBER_PERMISSIONS: PermissionKey[] = [
  'project.view',
  'task.create',
  'task.edit',
  'task.self_assign',
  'task.assignable',
  'task.delete_own',
  'chat.read',
  'chat.send',
  'chat.message.edit_own',
  'chat.message.delete_own',
  'file.upload',
  'file.delete_own',
];

export const SYSTEM_ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  MEMBER: 'Member',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/**
 * Factory default permission sets for editable system roles.
 * Used for "Reset to default" action in Admin Roles Manager.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<'Manager' | 'Member', PermissionKey[]> = {
  [SYSTEM_ROLES.MANAGER]: [...SYSTEM_ROLE_MANAGER_PERMISSIONS],
  [SYSTEM_ROLES.MEMBER]: [...SYSTEM_ROLE_MEMBER_PERMISSIONS],
};

/**
 * Permissions that can NEVER be assigned to non-Admin roles (Manager, Member, or Custom).
 * Enforced in server APIs and database constraints.
 */
export const LOCKED_ROLE_PERMISSIONS: PermissionKey[] = [
  'org.roles.manage',
];
