import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from monorepo root or web app
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function bootstrapFirstAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || 'wp34.department@gmail.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n🔍 Checking organization admin status for: ${adminEmail}...`);

  // 1. Check if an active Admin already exists
  const { data: existingAdmin, error: adminCheckError } = await supabase
    .from('profiles')
    .select('id, full_name, org_role, status')
    .eq('org_role', 'Admin')
    .eq('status', 'active')
    .maybeSingle();

  if (adminCheckError) {
    console.error('❌ Error querying profiles table:', adminCheckError.message);
    process.exit(1);
  }

  if (existingAdmin) {
    console.log(`ℹ️ An active Admin already exists (ID: ${existingAdmin.id}). Bootstrap procedure is closed.`);
    process.exit(0);
  }

  // 2. Generate secure one-time token and hash
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // 3. Create invitation entry
  const { error: inviteError } = await supabase.from('invitations').insert({
    email: adminEmail.toLowerCase().trim(),
    org_role: 'Admin',
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (inviteError) {
    console.error('❌ Failed to create admin invitation:', inviteError.message);
    process.exit(1);
  }

  // 4. Record audit log
  await supabase.from('audit_logs').insert({
    action: 'ADMIN_BOOTSTRAP_INVITATION_CREATED',
    entity: 'invitation',
    metadata: {
      email: adminEmail,
      org_role: 'Admin',
      expires_at: expiresAt,
    },
  });

  const activationUrl = `${appUrl}/invite/accept?token=${rawToken}`;

  console.log('\n======================================================');
  console.log('✅ FIRST ADMIN BOOTSTRAP INVITATION CREATED SUCCESSFULLY');
  console.log('======================================================');
  console.log(`Admin Email:    ${adminEmail}`);
  console.log(`Role:           Admin`);
  console.log(`Expires At:     ${expiresAt}`);
  console.log(`Activation URL: ${activationUrl}`);
  console.log('======================================================\n');
}

bootstrapFirstAdmin().catch((err) => {
  console.error('Unexpected error during admin bootstrap:', err);
  process.exit(1);
});
