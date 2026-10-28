import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationSchema } from '@project-hub/shared';
import { hashToken } from '@/lib/crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = acceptInvitationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { token, fullName, password, avatarUrl } = validationResult.data;
    const tokenHash = hashToken(token.trim());
    const adminSupabase = createAdminClient();

    // 1. Verify invitation validity
    const { data: invitation, error: fetchError } = await adminSupabase
      .from('invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (fetchError || !invitation) {
      return NextResponse.json(
        { error: 'INVITATION_NOT_FOUND', message: 'Invitation not found or invalid.' },
        { status: 404 }
      );
    }

    if (invitation.revoked_at) {
      return NextResponse.json(
        { error: 'INVITATION_REVOKED', message: 'This invitation has been revoked.' },
        { status: 410 }
      );
    }

    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'INVITATION_ALREADY_USED', message: 'This invitation has already been accepted.' },
        { status: 409 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'INVITATION_EXPIRED', message: 'This invitation has expired.' },
        { status: 410 }
      );
    }

    // 2. Create User in Supabase Auth
    const { data: authUser, error: authCreateError } = await adminSupabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authCreateError || !authUser.user) {
      return NextResponse.json(
        { error: 'USER_CREATION_FAILED', message: authCreateError?.message || 'Failed to create user account.' },
        { status: 500 }
      );
    }

    const userId = authUser.user.id;

    // 3. Insert into public.profiles
    const { error: profileError } = await adminSupabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      avatar_url: avatarUrl || null,
      org_role: invitation.org_role,
      status: 'active',
      is_totp_enabled: false,
    });

    if (profileError) {
      // Cleanup auth user if profile insertion failed
      await adminSupabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: 'PROFILE_CREATION_FAILED', message: profileError.message },
        { status: 500 }
      );
    }

    // 4. Mark invitation as accepted
    await adminSupabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    // 5. Record Audit Log
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');
    await recordAuditLog({
      actorId: userId,
      action: 'INVITATION_ACCEPTED',
      entity: 'user',
      entityId: userId,
      metadata: {
        email: invitation.email,
        orgRole: invitation.org_role,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully. You can now log in.',
      userId,
      email: invitation.email,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
