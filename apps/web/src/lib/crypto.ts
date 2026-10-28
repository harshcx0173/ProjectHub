import crypto from 'crypto';
import { authenticator } from 'otplib';

/**
 * Hash a sensitive token (such as an invitation token or recovery code) using SHA-256.
 * The raw token is NEVER stored in the database.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically secure random invitation token.
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate 10 secure random recovery codes for TOTP 2FA.
 * Returns raw codes for user display, and SHA-256 hashes for database storage.
 */
export function generateRecoveryCodes(): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 10; i++) {
    // 8-character uppercase alphanumeric code: XXXX-XXXX
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    rawCodes.push(code);
    hashedCodes.push(hashToken(code));
  }

  return { rawCodes, hashedCodes };
}

/**
 * Generate TOTP secret and provisioning URI for authenticator apps.
 */
export function generateTotpSecret(userEmail: string, appName: string = 'Project Hub') {
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(userEmail, appName, secret);
  return { secret, uri };
}

/**
 * Verify a 6-digit TOTP token against a secret.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
