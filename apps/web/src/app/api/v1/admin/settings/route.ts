import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { data: settings, error } = await supabase
      .from('org_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: settings || {
        company_name: 'Hydrated Studio',
        app_name: 'Project Hub',
        timezone: 'UTC',
        working_days: [1, 2, 3, 4, 5],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasAdminPerm = await checkUserPermission(user.id, 'org.settings.manage');
    if (!hasAdminPerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.settings.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const { companyName, appName, logoUrl, timezone, workingDays } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (companyName !== undefined) updates.company_name = companyName.trim();
    if (appName !== undefined) updates.app_name = appName.trim();
    if (logoUrl !== undefined) updates.logo_url = logoUrl;
    if (timezone !== undefined) updates.timezone = timezone.trim();
    if (workingDays !== undefined) updates.working_days = workingDays;

    // Check if settings row exists
    const { data: existing } = await supabase
      .from('org_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let saved = null;
    if (existing) {
      const { data, error } = await supabase
        .from('org_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from('org_settings')
        .insert({
          company_name: updates.company_name || 'Hydrated Studio',
          app_name: updates.app_name || 'Project Hub',
          logo_url: updates.logo_url || null,
          timezone: updates.timezone || 'UTC',
          working_days: updates.working_days || [1, 2, 3, 4, 5],
        })
        .select()
        .single();
      if (error) throw error;
      saved = data;
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'settings.update',
      entity: 'org_settings',
      entityId: saved.id,
      metadata: updates,
    });

    return NextResponse.json({ settings: saved });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
