import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpSchema } from '@project-hub/shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTotpToken, generateRecoveryCodes } from '@/lib/crypto';
import { recordAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = verifyTotpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.errors }, { status: 400 });
    }

    const { code } = parsed.data;
    const adminSupabase = createAdminClient();

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('totp_secret, is_totp_enabled')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.totp_secret) {
      return NextResponse.json(
        { error: 'NO_PENDING_SETUP', message: 'No 2FA setup in progress. Please start setup again.' },
        { status: 400 }
      );
    }

    const isValid = verifyTotpToken(code, profile.totp_secret);
    if (!isValid) {
      return NextResponse.json(
        { error: 'INVALID_TOTP_CODE', message: 'The 6-digit code is incorrect. Please try again.' },
        { status: 400 }
      );
    }

    // Generate 10 recovery codes
    const { rawCodes, hashedCodes } = generateRecoveryCodes();

    // Enable TOTP and store hashed recovery codes
    await adminSupabase
      .from('profiles')
      .update({
        is_totp_enabled: true,
        totp_recovery_codes: hashedCodes,
      })
      .eq('id', user.id);

    // Record audit log
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await recordAuditLog({
      actorId: user.id,
      action: '2FA_ENABLED',
      entity: 'user',
      entityId: user.id,
      metadata: { recoveryCodesCount: rawCodes.length },
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled.',
      recoveryCodes: rawCodes, // User must save these
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'VERIFICATION_FAILED', message: error.message || 'Failed to verify TOTP code.' },
      { status: 500 }
    );
  }
}
