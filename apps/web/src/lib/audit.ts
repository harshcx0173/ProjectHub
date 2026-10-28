import { createAdminClient } from './supabase/admin';

export interface RecordAuditParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Record an entry into the audit_logs table.
 * Uses the server-side admin client so audit writes are tamper-resistant.
 */
export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    const adminSupabase = createAdminClient();
    await adminSupabase.from('audit_logs').insert({
      actor_id: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    });
  } catch (error) {
    // Audit log errors must be logged safely without blowing up primary flow, but reported
    console.error('[Audit Log Failure]: Failed to record audit log:', error);
  }
}
