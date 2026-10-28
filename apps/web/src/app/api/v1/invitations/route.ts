import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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

    const hasInvitePerm = await checkUserPermission(user.id, 'org.invitations.manage');
    if (!hasInvitePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.invitations.manage permission' }, { status: 403 });
    }

    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('id, email, org_role, expires_at, accepted_at, revoked_at, created_at')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'FETCH_FAILED', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasInvitePerm = await checkUserPermission(user.id, 'org.invitations.manage');
    if (!hasInvitePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.invitations.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const orgRole = body.orgRole || 'Member';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'A valid email is required' }, { status: 400 });
    }

    // Generate single-use secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data: invite, error: insertError } = await supabase
      .from('invitations')
      .insert({
        email,
        org_role: orgRole,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'CREATE_FAILED', message: insertError.message }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4321';
    const inviteLink = `${appUrl}/invite/accept?token=${rawToken}`;

    await recordAuditLog({
      actorId: user.id,
      action: 'invitation.create',
      entity: 'invitation',
      entityId: invite.id,
      metadata: { email, orgRole },
    });

    return NextResponse.json({
      invitation: invite,
      inviteLink,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const hasInvitePerm = await checkUserPermission(user.id, 'org.invitations.manage');
    if (!hasInvitePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.invitations.manage permission' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'id is required' }, { status: 400 });
    }

    const { error: revokeError } = await supabase
      .from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (revokeError) {
      return NextResponse.json({ error: 'REVOKE_FAILED', message: revokeError.message }, { status: 500 });
    }

    await recordAuditLog({
      actorId: user.id,
      action: 'invitation.revoke',
      entity: 'invitation',
      entityId: inviteId,
      metadata: { revoked: true },
    });

    return NextResponse.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: err.message }, { status: 500 });
  }
}
