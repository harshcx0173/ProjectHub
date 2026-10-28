import { z } from 'zod';

export const auditLogSchema = z.object({
  id: z.string().uuid().optional(),
  actorId: z.string().uuid().nullable(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export type AuditLogEntry = z.infer<typeof auditLogSchema>;
