import { validateEnv, EnvConfig } from '@project-hub/shared';

let parsedEnv: EnvConfig;

try {
  parsedEnv = validateEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    STORAGE_BUCKET_NAME: process.env.STORAGE_BUCKET_NAME,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL,
  });
} catch (error) {
  // If in build phase or browser without server secrets, allow partial client env if defined
  if (typeof window !== 'undefined') {
    parsedEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Project Hub',
      NEXT_PUBLIC_COMPANY_NAME: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Hydrated Studio',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4321',
      ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || 'wp34.department@gmail.com',
      STORAGE_PROVIDER: 'supabase',
      STORAGE_BUCKET_NAME: 'project-files',
      SMTP_PORT: 587,
      SMTP_FROM_NAME: 'Project Hub',
    };
  } else {
    // Server runtime: fail immediately if missing required credentials
    throw error;
  }
}

export const env = parsedEnv;
