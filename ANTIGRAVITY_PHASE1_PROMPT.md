# Antigravity Prompt - Phase 1 (Project Management App)

Copy everything below this line into Antigravity. Before you do, place `PROJECT_PLAN.md` in the repository at `docs/PROJECT_PLAN.md`.

---

## ROLE

You are a senior full-stack engineer, a senior product designer and an application security engineer working together. Build Phase 1 of a company project management web app. Quality, security and correctness matter more than speed.

## SOURCE OF TRUTH

Read `docs/PROJECT_PLAN.md` completely before doing anything. It contains every locked decision: layout, roles, permission matrix, permission key catalog, database structure, security requirements, free-tier stack, app-ready architecture and design direction. If this prompt and the plan ever disagree, stop and ask me. Do not guess.

## THE PRODUCT IN ONE PARAGRAPH

A single-company (about 500 users), invitation-only project management web app. One screen holds a sidebar on the left, a project task board in the center and the project chat on the right. Roles are Admin, Manager and Member, plus custom roles created by Admin from a permission checklist. Web only now, but the structure must make a future mobile app cheap to build. Everything must run on free plans.

---

## STEP 0 - BEFORE WRITING ANY CODE

1. Read `docs/PROJECT_PLAN.md`.
2. Use planning mode. Produce an implementation plan and a task list with milestones. Wait for my approval before coding.
3. Ask me for everything you need. Do not invent values. At minimum ask for:
   - Supabase development project details (URL, anon key, and how I want the service role key provided), or confirm that a Supabase MCP or CLI session is already linked.
   - File storage choice for Phase 1: Cloudflare R2 (recommended) or Supabase Storage with small limits. Implement only the one I choose, behind a storage interface.
   - Email: whether a domain and Resend account exist. If not, the invitation flow must support copying the invite link manually, and that is the only path implemented. No fake email sending.
   - The email address of the first Admin.
   - The app name and logo.
4. Keep questions short and grouped in one message.

---

## NON-NEGOTIABLE RULES

### 1. No hardcoded values, no fake data, no silent fallbacks
- No mock data, dummy users, placeholder projects, lorem ipsum, fake counters, fake success states or sample content anywhere in the running app.
- All data comes from the database. Defaults such as default task statuses or default system roles are database seed data created by migrations, editable through the app, never constants inside UI code.
- Organization name, logo and settings come from the settings table.
- The permission key catalog is defined in exactly one place (the shared package), seeded into the database through a migration, and referenced everywhere else. No scattered permission strings and no role-name checks in logic. Check permissions, never role names.
- All configuration comes from environment variables. Validate them with a schema at startup. If a required variable is missing, fail immediately with a clear message. Never substitute a default for a missing secret, URL or key.
- Do not write fallback logic that hides problems (no catching an error and returning an empty list, no default values that mask a failed request, no optimistic success that is never confirmed). Handle errors properly: show a real error state with a clear message and a retry action, and log the error safely.
- Real empty states, loading skeletons and error states are required UI. They contain no fake data.
- If something cannot be done because information is missing, stop and ask me.

### 2. Supabase files and database changes
- Whenever you create a Supabase file (migration, policy, function, seed), run it directly against the development Supabase project through the Supabase CLI or Supabase MCP. Do not wait for me to run it.
- Additive changes may run directly: create table, create index, create policy, create function, create type, add a nullable column, insert seed rows.
- Any query or migration that deletes or edits existing data or structure requires my explicit permission BEFORE it runs. This includes: delete, update on existing rows, drop (table, column, policy, function, type, index), truncate, alter that changes or removes a column or type, replacing an existing function or policy, resetting the database, and bulk rewrites. For each one, stop and show me: the exact SQL, what it affects, why it is needed and whether it can be undone. Wait for my written approval. Approval for one operation does not cover another.
- Never run anything against a production or non-development database without my explicit permission.
- Keep every change as a versioned migration file in `supabase/migrations`. Never change the database by hand-editing without a migration.
- Never reveal or log secrets.

### 3. UI rules
- NO emojis anywhere in the interface: not in labels, buttons, headings, empty states, toasts, notifications, tooltips or placeholders. Use only proper icons from one icon set (Lucide) and proper UI elements.
- Message reactions are icon-based from a fixed set (for example thumbs up, check, heart, flag, eye) rendered as icons. No emoji picker anywhere. Text that users type themselves may contain emojis and must be displayed correctly. That is user content, not interface.
- Project icons: Admin picks from the icon library and a color, or uploads a custom image. No emoji icons.
- Light theme only. Professional, modern SaaS look: white and very light gray surfaces, thin neutral borders, soft shadows, one calm primary accent color, 8 to 12 px radius, Inter font, generous spacing on a 4 and 8 px grid. No dark colors for large surfaces, and no dark mode in Phase 1. The sidebar is light too.
- Define design tokens (color, spacing, radius, shadow, typography) in one central place so that dark mode could be added later without a refactor. Do not build dark mode now.
- Semantic status colors with labels or icons. Never color alone.
- Every screen needs loading, empty, error and success states, a responsive layout, visible keyboard focus, ARIA labels and WCAG AA contrast.
- Layout must follow the plan: sidebar left, task board center, chat panel right (collapsible and resizable), navbar on top with project switcher, search, notification bell and avatar.

### 4. Security rules (treat as mandatory, not optional)
- Public signup is disabled at every layer. The only way to create a user is an invitation.
- Invitation tokens are single-use, time-limited, revocable and stored only as a hash.
- RLS is enabled on every table with default deny. Write policies from the permission catalog. Server endpoints re-check permissions. Hiding a button is not security.
- Prevent IDOR: every read and write verifies access to the exact project, task, message or file.
- The service role key is used only on the server and never reaches the browser or any public environment variable.
- Validate all input with schemas on every endpoint. Use parameterized queries only.
- Sanitize chat content against XSS. Add a Content Security Policy and standard security headers. Add CSRF protection and strict CORS. Cookies are HttpOnly, Secure and SameSite.
- Rate limit login, password reset, invitation, upload and message endpoints.
- 2FA (TOTP) is mandatory for Admin and available to everyone. Provide recovery codes.
- Link previews must be fetched on the server with SSRF protection (block private and internal addresses, limit redirects, size and time).
- File uploads: private storage, signed URLs only, type allowlist with real content type checks, per-type size limits, executable files blocked, SVG and HTML treated as dangerous, random storage names, browser-side image resize with metadata stripping. Files go from the browser straight to storage with signed upload URLs and never through the Next.js server.
- Last Admin can never be demoted, disabled or deleted. Enforce in the database.
- Never put secrets, tokens, passwords or personal data into logs or error reports. Error messages must not leak internals.
- No default or hardcoded credentials anywhere. The first Admin is bootstrapped by a one-time documented procedure that uses the email I give you. It is not an open endpoint and not a default account.

### 5. Free-tier discipline
- Build for the free plans listed in the plan. Respect the limits: database size, realtime message quota, storage quota, rate limits.
- Realtime: subscribe only to the channel currently open plus one per-user notification channel. Throttle typing indicators. Do not use presence for every user.
- Keep files out of the database. Keep messages lean. Use cursor pagination everywhere.
- Add a weekly database backup job (GitHub Actions) and a keep-alive job, both documented.

### 6. App-ready structure
- Monorepo with pnpm and Turborepo: `apps/web`, `apps/mobile` (empty placeholder only, no code), `packages/shared` (types, validation schemas, permission catalog, constants, API wrapper), `supabase` (migrations, policies, tests, seed), `docs`.
- API first: sensitive operations (invite, upload URL creation, anything privileged) are token-authenticated, versioned endpoints under `/api/v1`, not cookie-only server actions.
- Keep business logic in services and hooks, separate from UI components.
- Use a consistent URL structure such as `/projects/:id/board`.
- Use cursor pagination and retry-safe (idempotent) writes.
- Keep the notification layer behind an abstraction (Web Push now, mobile push later).
- Avoid hosting-vendor-specific features so the app can move between hosts.

### 7. Audit rules
There are two meanings of audit, and I want both.
- Product feature: the audit log table and the Admin screen described in the plan. Record sensitive actions (invitations, role changes, project create, archive or delete, user disable, file delete, settings changes, login-related security events) with actor, action, entity, time and IP.
- Your own audit of your own work, at the end of EVERY milestone, before you call it done:
  1. Code audit: lint, strict type check, unused code, duplicated logic, error handling.
  2. Security audit: walk the security rules above, test RLS for every role (including a user with no access trying to reach other projects), attempt IDOR on every resource type, test file upload abuse, XSS payloads in chat, SSRF payloads in link previews, rate limits.
  3. UI audit: every screen in every state, responsive widths, keyboard navigation, focus, contrast, zero emojis, zero fake data, matches the light design system.
  4. Functionality audit: run each acceptance criterion end to end against the real Supabase project. Use the browser agent where available to click through flows.
  5. Write the results to `docs/audits/milestone-N-audit.md` with: what was tested, what failed, what you fixed, and what remains. Be honest. Do not claim something works unless you ran it.
- Final step of Phase 1: a full audit across the whole app, with a launch-readiness checklist.

---

## TECH STACK (all free tiers)

- Next.js (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Lucide icons, Inter font
- TanStack Query, TanStack Virtual, TanStack Table, React Hook Form, Zod
- dnd-kit (Kanban), TipTap (chat composer), cmdk (command palette)
- Supabase: Postgres, Auth (email and password, TOTP 2FA), Realtime, RLS, pg_cron
- Postgres full-text search for global search
- File storage: the provider I choose in Step 0, behind an interface (Cloudflare R2 with presigned uploads is the recommendation)
- Email: Resend if a domain exists, otherwise manual invite links
- Rate limiting: Upstash Redis free tier, or a Postgres-based limiter if I prefer
- Testing: Vitest, Playwright, pgTAP for RLS tests through Supabase CLI
- Tooling: ESLint, Prettier, Husky, gitleaks, Dependabot, GitHub Actions
- Monitoring: Sentry free tier

Do not add AI, Groq, Vault or Messages-menu code in Phase 1.

---

## PHASE 1 SCOPE AND ACCEPTANCE CRITERIA

Build in this order. After each milestone: run the audit, write the audit file, then stop and report to me before starting the next one.

### Milestone 1 - Foundation and access
- Monorepo, environments, validated env config, CI, linting, tests setup.
- Database schema for identity, roles, permissions, invitations, projects, audit logs, org settings, with RLS and the seeded permission catalog and system roles.
- Invitation-only authentication: first Admin bootstrap, accept invitation, login, logout, forgot and reset password, TOTP 2FA (mandatory for Admin) with recovery codes, session list and sign out everywhere.
- RLS test suite for every role.
- Acceptance: signup is impossible by any route, an expired or revoked or reused invite fails with a clear page, a user with no membership cannot read any project data, last Admin protection works.

### Milestone 2 - Shell, projects and navigation
- App shell exactly as planned: top navbar, collapsible sidebar, content area, light design system with central tokens.
- Sidebar: Home, My Tasks, Inbox, Search, Pinned, Recent, All Projects grouped in folders, project sub menus (Board, Files, Members, Settings), unread badges, Admin section for Admin only.
- Projects: create, edit, archive, project groups, icon and color editable by Admin only (icon library, color, or uploaded image), members and project roles, pin and recent per user.
- Global search and command palette (Ctrl+K) across projects, tasks, messages, files and people, permission-aware, built on Postgres full-text search.
- Acceptance: a Member sees only their projects, search never returns something the user cannot open, icon editing is impossible for non-Admin even by direct API call.

### Milestone 3 - Task board
- Per-project statuses (columns) with order, tasks with auto key numbers, title, rich description, priority, due date, assignees, watchers, labels, checklist items, comments and activity.
- Board view with drag and drop and List view with sorting and filters. My Tasks across projects.
- Task side drawer that opens without closing the chat.
- Acceptance: drag and drop persists and is permission-checked, concurrent edits do not silently overwrite each other, delete is soft delete, every state of every view is designed.

### Milestone 4 - Project chat and files
- Realtime project channel in the right panel: threads, mentions, icon reactions, edit and delete own message, moderation delete, pin, typing indicator, unread counts, in-chat search, rich text, link preview cards with SSRF protection.
- Attachments: images with inline preview, audio with an in-app player and voice note recording, documents, meeting recordings with a player. Direct-to-storage uploads, with progress, cancel and retry.
- Message to task conversion, and task link cards in chat.
- Files tab with filters (images, audio, recordings, documents) and preview.
- Acceptance: a user outside the project cannot read messages, files or signed URLs of that project, uploads obey type and size rules, XSS payloads render inert, the chat panel collapses and resizes.

### Milestone 5 - Notifications, profile and Admin panel
- Notifications: realtime bell, full page, preferences, due-soon reminders through a scheduled job, invitation delivery (email or copy link as decided in Step 0).
- Profile: change profile photo (with the upload rules), name, designation, timezone, password, 2FA, notification preferences, active sessions.
- Admin panel: Users (list, role change, disable and offboarding with session revoke and task reassignment), Invitations (create, resend, revoke, copy link), Roles (system roles locked, custom role builder from the permission checklist, locked permissions not assignable), Projects, Audit logs with filters, Organization settings.
- Installable PWA, and browser push only if it does not break the free-tier rules.
- Acceptance: custom role permissions are enforced by RLS and endpoints, not only the UI, every sensitive action appears in the audit log, a disabled user loses access immediately.

### Milestone 6 - Hardening and launch readiness
- Full audit of the whole app, fix everything found.
- Playwright end-to-end tests for the critical flows: invite and login, create project, move task, chat and upload, role restriction.
- Documentation: setup guide, environment variables list (names only, no values), backup and restore guide with a restore test, security checklist, known limits of the free tiers.

---

## OUT OF SCOPE FOR PHASE 1 (do not build, and do not show dead menu items for them)

AI of any kind (@ai and the personal AI Assistant), the Vault, the Messages menu (DMs and groups), calendar view, reports, integrations, dark mode, the native mobile app. The database and code should not block adding them later, but no unused tables or placeholder screens for them.

---

## DEFINITION OF DONE FOR EVERY FEATURE

- Works end to end against the real Supabase project, not mocks.
- Permissions enforced in RLS and in endpoints, with tests.
- Loading, empty, error and success states exist and are designed.
- Responsive, keyboard accessible, no console errors, no emojis, no fake data, no hardcoded values.
- Sensitive actions are written to the audit log.
- Input validated, output sanitized.
- Migration files committed, applied to development, and any destructive step approved by me first.

## HOW TO REPORT TO ME

Keep reports short and honest. After each milestone give: what was built, what was tested and how, what failed and was fixed, what is still open, and which questions or approvals you need. Never say something is working unless you ran it.
