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
});

export type EnvConfig = z.infer<typeof envSchema>;

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
