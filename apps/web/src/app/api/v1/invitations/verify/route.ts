import { NextRequest, NextResponse } from 'next/server';
import { hashToken } from '@/lib/crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawToken = searchParams.get('token');

  if (!rawToken || rawToken.trim().length < 16) {
    return NextResponse.json(
      { error: 'INVALID_TOKEN_FORMAT', message: 'A valid invitation token is required.' },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(rawToken.trim());
  const adminSupabase = createAdminClient();

  const { data: invitation, error } = await adminSupabase
    .from('invitations')
    .select('id, email, org_role, expires_at, accepted_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !invitation) {
    return NextResponse.json(
      { error: 'INVITATION_NOT_FOUND', message: 'This invitation does not exist or has been removed.' },
      { status: 404 }
    );
  }

  if (invitation.revoked_at) {
    return NextResponse.json(
      { error: 'INVITATION_REVOKED', message: 'This invitation has been revoked by an administrator.' },
      { status: 410 }
    );
  }

  if (invitation.accepted_at) {
    return NextResponse.json(
      { error: 'INVITATION_ALREADY_USED', message: 'This invitation has already been accepted.' },
      { status: 409 }
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();
  if (isExpired) {
    return NextResponse.json(
      { error: 'INVITATION_EXPIRED', message: 'This invitation link has expired. Please request a new invite.' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    valid: true,
    email: invitation.email,
    orgRole: invitation.org_role,
    expiresAt: invitation.expires_at,
  });
}
