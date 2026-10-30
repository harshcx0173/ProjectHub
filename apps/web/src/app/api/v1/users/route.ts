import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    // Check that requester is an active member of the organization
    const { data: requesterProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !requesterProfile || requesterProfile.status !== 'active') {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'User is deactivated or not found' }, { status: 403 });
    }

    // Return non-sensitive colleague profile directory for workspace collaboration
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, designation, org_role, created_at')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
