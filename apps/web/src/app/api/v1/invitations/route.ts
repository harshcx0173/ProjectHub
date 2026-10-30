import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { sendInvitationEmail } from '@/lib/email/smtp';

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

    // Fetch inviter profile and org settings for personalized email
    const [{ data: inviterProfile }, { data: orgSettings }] = await Promise.all([
      supabase.from('profiles').select('full_name, org_role').eq('id', user.id).maybeSingle(),
      supabase.from('org_settings').select('name').limit(1).maybeSingle(),
    ]);

    const orgName = orgSettings?.name || process.env.NEXT_PUBLIC_APP_NAME || 'Project Hub';
    const inviterName = inviterProfile?.full_name || 'Team Administrator';
    const inviterRole = inviterProfile?.org_role || 'Admin';

    // Send invitation email asynchronously
    const emailResult = await sendInvitationEmail({
      recipientEmail: email,
      inviterName,
      inviterRole,
      orgName,
      inviteLink,
      expiresAt,
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'invitation.create',
      entity: 'invitation',
      entityId: invite.id,
      metadata: {
        email,
        orgRole,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
      },
    });

    return NextResponse.json({
      invitation: invite,
      inviteLink,
      emailDelivery: {
        sent: emailResult.success,
        error: emailResult.error || null,
      },
    }, { status: 201 });
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

    const hasInvitePerm = await checkUserPermission(user.id, 'org.invitations.manage');
    if (!hasInvitePerm) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'Missing org.invitations.manage permission' }, { status: 403 });
    }

    const body = await request.json();
    const inviteId = body.id;

    if (!inviteId) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invitation ID is required' }, { status: 400 });
    }

    // Generate fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: updatedInvite, error: updateError } = await supabase
      .from('invitations')
      .update({
        token_hash: tokenHash,
        expires_at: expiresAt,
        revoked_at: null,
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'UPDATE_FAILED', message: updateError.message }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4321';
    const inviteLink = `${appUrl}/invite/accept?token=${rawToken}`;

    // Fetch inviter profile and org settings for email dispatch
    const [{ data: inviterProfile }, { data: orgSettings }] = await Promise.all([
      supabase.from('profiles').select('full_name, org_role').eq('id', user.id).maybeSingle(),
      supabase.from('org_settings').select('name').limit(1).maybeSingle(),
    ]);

    const orgName = orgSettings?.name || process.env.NEXT_PUBLIC_APP_NAME || 'Project Hub';
    const inviterName = inviterProfile?.full_name || 'Team Administrator';
    const inviterRole = inviterProfile?.org_role || 'Admin';

    const emailResult = await sendInvitationEmail({
      recipientEmail: updatedInvite.email,
      inviterName,
      inviterRole,
      orgName,
      inviteLink,
      expiresAt,
    });

    await recordAuditLog({
      actorId: user.id,
      action: 'invitation.resend',
      entity: 'invitation',
      entityId: inviteId,
      metadata: {
        email: updatedInvite.email,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
      },
    });

    return NextResponse.json({
      success: true,
      inviteLink,
      invitation: updatedInvite,
      emailDelivery: {
        sent: emailResult.success,
        error: emailResult.error || null,
      },
      message: 'Invitation refreshed with a new 7-day token',
    });
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
