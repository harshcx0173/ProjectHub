# Project Hub - Environment Variables Reference

This document catalogs all environment variables used across the Project Hub monorepo.

| Variable Name | Environment | Type | Purpose | Sensitivity |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | URL | Supabase Cloud project endpoint URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | JWT | Supabase anonymous / public API key | Public (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | JWT | Supabase elevated admin key for background jobs, invitations & audit logs | **Secret (Server Only)** |
| `NEXT_PUBLIC_APP_NAME` | Client & Server | String | Display name of the application (e.g. `Project Hub`) | Public |
| `NEXT_PUBLIC_COMPANY_NAME` | Client & Server | String | Organization/company name (e.g. `Hydrated Studio`) | Public |
| `NEXT_PUBLIC_APP_URL` | Client & Server | URL | Base URL used to formulate invitation acceptance links | Public |
| `ADMIN_BOOTSTRAP_EMAIL` | Server Only | Email | Designated email address for initial Admin bootstrap procedure | Internal |
| `STORAGE_PROVIDER` | Server Only | String | File storage provider (`supabase` or `r2`) | Internal |
| `STORAGE_BUCKET_NAME` | Server Only | String | Name of the private storage bucket (`project-files`) | Internal |

---

### Security Constraints:
1. `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_` and must never be exposed to client bundles or browser code.
2. All environment variables are validated at runtime against Zod schemas in `@project-hub/shared/schemas/env.ts`. Any missing required variable causes an immediate fail-fast termination with clear diagnostics.
