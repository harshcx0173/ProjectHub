import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkUserPermission } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { testSmtpHealth } from '@/lib/email/smtp';

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

    const canTest = await checkUserPermission(user.id, 'org.invitations.manage');
    if (!canTest) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Missing org.invitations.manage permission' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const testRecipient = (body.testRecipient || '').trim().toLowerCase();

    if (!testRecipient || !testRecipient.includes('@')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'A valid recipient email address is required.' },
        { status: 400 }
      );
    }

    const result = await testSmtpHealth(testRecipient);

    await recordAuditLog({
      actorId: user.id,
      action: 'admin.smtp.test',
      entity: 'org_settings',
      entityId: user.id,
      metadata: {
        testRecipient,
        success: result.success,
        error: result.error || null,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: `SMTP test failed: ${result.error}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Test email dispatched successfully to ${testRecipient}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
