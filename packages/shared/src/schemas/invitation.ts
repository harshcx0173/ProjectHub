import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().email('Please provide a valid email address').trim().toLowerCase(),
  orgRole: z.enum(['Admin', 'Manager', 'Member']).default('Member'),
  presetProjectIds: z.array(z.string().uuid()).default([]),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32, 'Invalid invitation token format'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  avatarUrl: z.string().url().optional(),
});

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;
