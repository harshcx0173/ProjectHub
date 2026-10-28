import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    // Revoke all other refresh tokens for this user
    await adminSupabase.auth.admin.signOut(user.id, 'others');

    await recordAuditLog({
      actorId: user.id,
      action: 'SESSIONS_REVOKED_OTHERS',
      entity: 'session',
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'All other active sessions have been signed out.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'REVOKE_FAILED', message: error.message || 'Failed to revoke other sessions.' },
      { status: 500 }
    );
  }
}
