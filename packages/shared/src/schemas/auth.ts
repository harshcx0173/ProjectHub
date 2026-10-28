import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
});

export const verifyTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export const verifyRecoveryCodeSchema = z.object({
  code: z.string().min(8, 'Recovery code must be valid format').trim(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;
export type VerifyRecoveryCodeInput = z.infer<typeof verifyRecoveryCodeSchema>;
