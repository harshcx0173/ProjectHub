import { z } from 'zod';

export const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be provided'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, 'SUPABASE_SERVICE_ROLE_KEY must be provided on server'),

  // Branding
  NEXT_PUBLIC_APP_NAME: z.string().default('Project Hub'),
  NEXT_PUBLIC_COMPANY_NAME: z.string().default('Hydrated Studio'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:4321'),

  // First Admin Bootstrap Email
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default('wp34.department@gmail.com'),

  // Storage
  STORAGE_PROVIDER: z.enum(['supabase', 'r2']).default('supabase'),
  STORAGE_BUCKET_NAME: z.string().default('project-files'),

  // Optional SMTP Configuration (Gmail / Google Workspace App Password)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional().default('Project Hub'),
  SMTP_FROM_EMAIL: z.string().email().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const smtpConfigSchema = z.object({
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required (e.g., smtp.gmail.com)'),
  SMTP_PORT: z.coerce.number().int().positive('SMTP_PORT must be a valid positive port (e.g., 587 or 465)'),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required (e.g., email@gmail.com)'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS app password is required'),
  SMTP_FROM_NAME: z.string().default('Project Hub'),
  SMTP_FROM_EMAIL: z.string().email().optional(),
});

export type SmtpConfig = z.infer<typeof smtpConfigSchema>;

/**
 * Validates SMTP configuration strictly before sending emails.
 */
export function validateSmtpConfig(rawEnv: Record<string, string | undefined>): SmtpConfig {
  const result = smtpConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `SMTP configuration is missing or invalid:\n${errorDetails}\nPlease configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your environment.`
    );
  }
  return result.data;
}

/**
 * Validates environment variables. Throws immediately with descriptive message if invalid.
 */
export function validateEnv(rawEnv: Record<string, string | undefined>): EnvConfig {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(
      `\n[ERROR: Environment Configuration] Missing or invalid environment variables:\n${errorDetails}\nPlease check your .env.local file.\n`
    );
  }
  return result.data;
}
