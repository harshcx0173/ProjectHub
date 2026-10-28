import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit';

export async function DELETE(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Call revoke_all_user_sessions RPC or update user_sessions
    await supabase.rpc('revoke_all_user_sessions', { p_user_id: user.id });

    await recordAuditLog({
      actorId: user.id,
      action: 'session.revoke_all',
      entity: 'user_sessions',
      entityId: user.id,
      metadata: { reason: 'User requested sign out from all sessions' },
    });

    return NextResponse.json({ success: true, message: 'All active sessions revoked' });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
