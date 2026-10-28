import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasAuditPerm = await checkUserPermission(user.id, 'org.audit.view');
    if (!hasAuditPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.audit.view permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get('action');

    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        entity_type,
        entity_id,
        metadata,
        ip_address,
        user_agent,
        created_at,
        profiles (
          id,
          full_name,
          org_role
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (actionFilter) {
      query = query.eq('action', actionFilter);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    const formatted = (logs || []).map((l: any) => ({
      id: l.id,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id,
      metadata: l.metadata,
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      actor: l.profiles,
    }));

    return NextResponse.json({ logs: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
