import { z } from 'zod';

export const createProjectGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50),
  position: z.number().int().default(0),
});

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(80),
  key: z
    .string()
    .min(2, 'Project key must be 2 to 5 uppercase characters')
    .max(5)
    .regex(/^[A-Z0-9]+$/, 'Project key must contain only uppercase letters and digits'),
  description: z.string().max(500).optional(),
  groupId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#2563EB'),
  iconType: z.enum(['lucide', 'upload']).default('lucide'),
  iconValue: z.string().default('Folder'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
});

export const updateProjectAdminFieldsSchema = z.object({
  iconType: z.enum(['lucide', 'upload']).optional(),
  iconValue: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isArchived: z.boolean().optional(),
});

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  projectRole: z.enum(['Admin', 'Manager', 'Member']).default('Member'),
});

export const removeProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const togglePinProjectSchema = z.object({
  projectId: z.string().uuid(),
  isPinned: z.boolean(),
});

export type CreateProjectGroupInput = z.infer<typeof createProjectGroupSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectAdminFieldsInput = z.infer<typeof updateProjectAdminFieldsSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type TogglePinProjectInput = z.infer<typeof togglePinProjectSchema>;
