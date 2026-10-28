import { PermissionKey, SystemRoleName } from '../permissions/catalog';

export interface UserProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  designation: string | null;
  timezone: string;
  status: 'active' | 'disabled';
  orgRole: SystemRoleName | string;
  isTotpEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  orgRole: string;
  presetProjects: string[];
  tokenHash: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitedBy: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  isLocked: boolean;
  description: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  key: PermissionKey;
  scope: 'org' | 'project';
  group: string;
  isAssignable: boolean;
}

export interface OrgSettings {
  id: string;
  companyName: string;
  logoUrl: string | null;
  timezone: string;
  workingDays: number[];
  createdAt: string;
  updatedAt: string;
}
