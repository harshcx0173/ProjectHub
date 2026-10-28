import { describe, it, expect } from 'vitest';
import {
  hashToken,
  generateInvitationToken,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotpToken,
} from './crypto';
import { authenticator } from 'otplib';

describe('Cryptographic Utilities', () => {
  it('hashes tokens deterministically with SHA-256', () => {
    const raw = 'my-secret-invitation-token-123';
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    expect(hash1).not.toBe(raw);
  });

  it('generates cryptographically random 64-char invitation tokens', () => {
    const token1 = generateInvitationToken();
    const token2 = generateInvitationToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('generates 10 valid recovery codes and matching hashes', () => {
    const { rawCodes, hashedCodes } = generateRecoveryCodes();

    expect(rawCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);

    // Each code matches XXXX-XXXX format
    for (let i = 0; i < 10; i++) {
      expect(rawCodes[i]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      expect(hashToken(rawCodes[i]!)).toBe(hashedCodes[i]);
    }

    // Verify all 10 are unique
    const uniqueRaw = new Set(rawCodes);
    expect(uniqueRaw.size).toBe(10);
  });

  it('generates and verifies TOTP codes correctly', () => {
    const { secret, uri } = generateTotpSecret('test@company.com', 'Project Hub');
    expect(secret).toBeDefined();
    expect(uri).toContain('Project%20Hub');

    // Generate token with otplib
    const currentToken = authenticator.generate(secret);
    expect(verifyTotpToken(currentToken, secret)).toBe(true);

    // Invalid token
    expect(verifyTotpToken('000000', secret)).toBe(false);
  });
});
