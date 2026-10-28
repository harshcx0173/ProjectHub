import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { generateTotpSecret } from '@/lib/crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    const { secret, uri } = generateTotpSecret(user.email ?? 'user@projecthub.local', 'Project Hub');
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    // Temporarily save secret in profile or pending state
    const adminSupabase = createAdminClient();
    await adminSupabase
      .from('profiles')
      .update({ totp_secret: secret })
      .eq('id', user.id);

    return NextResponse.json({
      secret,
      qrCodeDataUrl,
      uri,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'TOTP_SETUP_FAILED', message: error.message || 'Failed to initialize TOTP setup' },
      { status: 500 }
    );
  }
}
