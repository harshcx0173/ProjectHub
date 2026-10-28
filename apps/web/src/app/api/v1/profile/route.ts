import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    // Fetch user sessions
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('id, ip_address, user_agent, last_active_at, created_at')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_active_at', { ascending: false });

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: user.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        designation: profile.designation,
        timezone: profile.timezone,
        orgRole: profile.org_role,
        status: profile.status,
        isTotpEnabled: profile.is_totp_enabled,
        createdAt: profile.created_at,
      },
      sessions: sessions || [],
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

    const body = await request.json();
    const { fullName, designation, timezone } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined) updates.full_name = fullName.trim();
    if (designation !== undefined) updates.designation = designation.trim();
    if (timezone !== undefined) updates.timezone = timezone.trim();

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: error.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'profile.update',
      entity: 'profile',
      entityId: user.id,
      metadata: updates,
    });

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
