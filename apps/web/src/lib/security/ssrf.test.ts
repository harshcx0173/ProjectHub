import { describe, it, expect } from 'vitest';
import { isPrivateOrReservedIP, validateSafeExternalUrl } from './ssrf';

describe('SSRF Protection Guardrails', () => {
  it('detects private and loopback IPv4 addresses', () => {
    expect(isPrivateOrReservedIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIP('172.16.0.5')).toBe(true);
    expect(isPrivateOrReservedIP('169.254.169.254')).toBe(true); // AWS/GCP metadata
  });

  it('permits public IP addresses', () => {
    expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIP('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIP('142.250.190.46')).toBe(false); // Google
  });

  it('blocks non-HTTP protocols', async () => {
    await expect(validateSafeExternalUrl('ftp://example.com')).rejects.toThrow(
      'Only HTTP and HTTPS URLs are permitted'
    );
    await expect(validateSafeExternalUrl('file:///etc/passwd')).rejects.toThrow(
      'Only HTTP and HTTPS URLs are permitted'
    );
  });

  it('blocks localhost directly', async () => {
    await expect(validateSafeExternalUrl('http://localhost:3000')).rejects.toThrow(
      'Access to local/internal hostnames is blocked'
    );
  });
});

