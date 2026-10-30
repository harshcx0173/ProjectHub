import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { recordAuditLog } from '@/lib/audit';

function generateRecoveryCode(): string {
  return `${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

/**
 * GET: Generate a new set of 8 recovery codes for the authenticated user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }

  // Generate 8 codes
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const code = generateRecoveryCode();
    plainCodes.push(code);
    hashedCodes.push(hashCode(code));
  }

  // Save hashed codes to user's profile
  const { error } = await supabase
    .from('profiles')
    .update({ totp_recovery_codes: hashedCodes })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'DATABASE_ERROR', message: error.message }, { status: 500 });
  }

  await recordAuditLog({
    actorId: user.id,
    action: 'auth.2fa.recovery_codes_generated',
    entity: 'auth',
    entityId: user.id,
  });

  return NextResponse.json({ recoveryCodes: plainCodes });
}

/**
 * POST: Verify and consume a recovery code for 2FA fallback.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
  }

  try {
    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'BAD_REQUEST', message: 'Recovery code is required' }, { status: 400 });
    }

    const hashedInput = hashCode(code);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('totp_recovery_codes')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Profile not found' }, { status: 404 });
    }

    const codes: string[] = profile.totp_recovery_codes || [];
    const codeIndex = codes.indexOf(hashedInput);

    if (codeIndex === -1) {
      return NextResponse.json({ error: 'INVALID_CODE', message: 'Invalid or already used recovery code' }, { status: 400 });
    }

    // Remove consumed code (single use)
    const updatedCodes = codes.filter((_, idx) => idx !== codeIndex);
    await supabase
      .from('profiles')
      .update({ totp_recovery_codes: updatedCodes })
      .eq('id', user.id);

    await recordAuditLog({
      actorId: user.id,
      action: 'auth.2fa.recovery_code_consumed',
      entity: 'auth',
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      remainingCodes: updatedCodes.length,
      message: 'Recovery code verified successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
  }
}

