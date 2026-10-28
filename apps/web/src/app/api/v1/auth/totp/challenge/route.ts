import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTotpToken, hashToken } from '@/lib/crypto';
import { recordAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Session required' }, { status: 401 });
    }

    const body = await request.json();
    const { code, isRecoveryCode } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'CODE_REQUIRED', message: 'A verification code is required.' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('totp_secret, is_totp_enabled, totp_recovery_codes')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.is_totp_enabled) {
      return NextResponse.json({ error: '2FA_NOT_ENABLED', message: '2FA is not enabled for this user.' }, { status: 400 });
    }

    let verified = false;

    if (isRecoveryCode) {
      // Check recovery code
      const formattedCode = code.trim().toUpperCase();
      const codeHash = hashToken(formattedCode);
      const remainingCodes = (profile.totp_recovery_codes || []).filter(
        (storedHash: string) => storedHash !== codeHash
      );

      if (remainingCodes.length < (profile.totp_recovery_codes?.length || 0)) {
        verified = true;
        // Consume the recovery code (single use)
        await adminSupabase
          .from('profiles')
          .update({ totp_recovery_codes: remainingCodes })
          .eq('id', user.id);

        await recordAuditLog({
          actorId: user.id,
          action: '2FA_RECOVERY_CODE_USED',
          entity: 'user',
          entityId: user.id,
          metadata: { remainingCount: remainingCodes.length },
        });
      }
    } else {
      // Standard TOTP code
      if (profile.totp_secret) {
        verified = verifyTotpToken(code.trim(), profile.totp_secret);
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'INVALID_CODE', message: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication verified successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'CHALLENGE_FAILED', message: error.message || 'Verification challenge failed.' },
      { status: 500 }
    );
  }
}
