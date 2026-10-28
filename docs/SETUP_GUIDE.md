# Project Hub - Deployment & Setup Guide

This guide details the complete procedure for setting up, deploying, and maintaining **Project Hub** in production and development environments.

---

## 1. Prerequisites

- **Node.js**: v20 or v22 LTS
- **Package Manager**: pnpm v9+ or v12 (`npm install -g pnpm`)
- **Cloud Provider**: Supabase Cloud project (`https://supabase.com`)
- **Storage**: Supabase Storage bucket (`project-files`)

---

## 2. Environment Configuration

Create `.env.local` in the project root and in `apps/web/.env.local` using the template below:

```bash
# Supabase Cloud Project URL and Keys
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-or-publishable-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-secret-key>"

# Application Identity & Branding
NEXT_PUBLIC_APP_NAME="Project Hub"
NEXT_PUBLIC_COMPANY_NAME="Hydrated Studio"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# First Administrator Bootstrap Email
ADMIN_BOOTSTRAP_EMAIL="admin@yourcompany.com"

# Storage Settings
STORAGE_PROVIDER="supabase"
STORAGE_BUCKET_NAME="project-files"
```

> **Security Note**: Never commit `.env.local` or disclose the `SUPABASE_SERVICE_ROLE_KEY`. It must be stored only on trusted servers.

---

## 3. Database Migrations

Apply the database schema in the Supabase SQL Editor (`https://supabase.com/dashboard/project/<ref>/sql/new`):

1. **Milestone 1 Core Schema & Seed**:
   Run `supabase/migrations/full_initial_setup.sql`. This sets up profiles, roles, permissions, invitations, audit logs, and system triggers.
2. **Milestones 2 to 5 Schema**:
   Run `supabase/migrations/milestones_2_to_5_schema.sql`. This sets up projects, project members, task board columns, tasks with auto-incrementing keys (`PRJ-101`), checklists, comments, realtime chat channels, messages, icon reactions, storage policies, and notifications.

---

## 4. First Administrator Bootstrap

Since public signups are completely disabled, bootstrap the initial administrator account by running:

```bash
pnpm --filter @project-hub/web bootstrap-admin
```

This will print a secure, single-use invitation link:
```
http://localhost:3000/invite/accept?token=<secure-hex-token>
```
Open the link in your browser, set your full name and password, scan the QR code to activate mandatory TOTP two-factor authentication, and save your recovery codes.

---

## 5. Running the Application

### Development Server:
```bash
pnpm dev
```
Open `http://localhost:3000`.

### Production Build & Launch:
```bash
pnpm build
pnpm start
```
