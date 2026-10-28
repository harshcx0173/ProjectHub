import { describe, it, expect } from 'vitest';
import { validateEnv } from './env';
import { acceptInvitationSchema } from './invitation';

describe('Environment Variable Validation', () => {
  it('throws descriptive error if required Supabase variables are missing', () => {
    expect(() =>
      validateEnv({
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
      })
    ).toThrowError(/Missing or invalid environment variables/);
  });

  it('validates correctly when proper URLs and keys are supplied', () => {
    const validConfig = validateEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://testproject.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-with-sufficient-length-12345',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-with-sufficient-length-12345',
    });

    expect(validConfig.NEXT_PUBLIC_APP_NAME).toBe('Project Hub');
    expect(validConfig.STORAGE_PROVIDER).toBe('supabase');
  });
});

describe('Invitation & Password Schema Complexity', () => {
  it('rejects passwords lacking complexity', () => {
    // Too short (less than 10 chars)
    expect(
      acceptInvitationSchema.safeParse({
        token: 'a'.repeat(32),
        fullName: 'Test User',
        password: 'Pass1!',
      }).success
    ).toBe(false);

    // No special char
    expect(
      acceptInvitationSchema.safeParse({
        token: 'a'.repeat(32),
        fullName: 'Test User',
        password: 'Password1234',
      }).success
    ).toBe(false);

    // No uppercase
    expect(
      acceptInvitationSchema.safeParse({
        token: 'a'.repeat(32),
        fullName: 'Test User',
        password: 'password1234!',
      }).success
    ).toBe(false);
  });

  it('accepts compliant passwords', () => {
    const res = acceptInvitationSchema.safeParse({
      token: 'a'.repeat(32),
      fullName: 'Valid User',
      password: 'StrongPassword123!',
    });
    expect(res.success).toBe(true);
  });
});
