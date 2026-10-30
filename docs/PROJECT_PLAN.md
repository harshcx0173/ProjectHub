# Company Project Management App - Master Plan

Status: Planning complete, Phase 1 ready to build
Audience: Product owner (Harsh), and the AI coding agent that builds the app
Language of this document: English (simple wording on purpose, so an agent can follow it precisely)

---

## 1. Overview

A project management web app for ONE single company (single tenant, about 500 users).
It is invite-only. Nobody can sign up on their own.

The main idea that makes it different from typical tools: the task board and the project chat live side by side on one screen, so people never switch context.

- Web only for now.
- The structure and flows must be ready to become a mobile app later without a rewrite.
- Everything must be buildable and runnable on free plans for now.

---

## 2. Locked decisions

| Area | Decision |
|---|---|
| Users | Around 500, one company |
| Access | Invitation only, public signup disabled everywhere |
| Roles | Admin (locked), Manager (default, editable permissions), Member (default, editable permissions), plus custom roles created by Admin. System roles cannot be deleted or renamed. "Reset to default" for Manager and Member. |
| Permissions | Granular keys. Includes `task.assign`, `task.self_assign`, and `task.assignable`. Locked permissions cannot be granted to non-Admins. |
| Layout | Left: sidebar. Center: task board (per project). Right: project chat. Top: navbar with logo area, search, bell, avatar |
| Personal Space | Dedicated `/personal` sticky notes space for all active users. Private via strict RLS. Warm off-white canvas with coral add button. Plain text and checklist modes. Note-to-task conversion. |
| Email | SMTP via Nodemailer (Gmail / Google Workspace App Password support) with Admin choice to "Send email" or "Copy link". |
| Project icon | Editable by Admin only |
| Messaging | Microsoft Teams style, no calling features |
| Profile | Users can change their own profile picture (client-side resize and EXIF metadata stripping) |
| Chat uploads | Images, audio, links, documents, meeting recordings (Supabase Storage with size limits and MIME allowlists) |
| @ai in project chat | Phase 2: Anyone can use it, only inside project channels, only about that project |
| Messages menu | Phase 2: Separate sidebar menu: user-to-user DMs and groups, plus a personal AI Assistant limited to the user's assigned projects |
| Vault | Phase 2: One Vault tab per project. All project members can view and add. Only Admin can edit and delete |
| AI provider | Phase 2: Groq (existing API key), free tier |
| Stack | Next.js 15 (App Router, Port 4321) + Supabase (Cloud Postgres, Auth, Realtime, Storage) |
| Hosting & Dev | Local dev on port 4321. Production on Cloudflare or Vercel Pro later |
| UI | Modern, professional SaaS, LIGHT theme only, no dark colors, zero emojis in UI elements/reactions, Inter font, design tokens |

---

## 3. Layout and UX

### 3.1 Main screen
Three zones plus a navbar:

1. Sidebar (left): main menus, sub menus, projects.
2. Task board (center): Kanban for the selected project, with List view as an alternative.
3. Project chat (right): chat of the selected project.
4. Navbar (top): logo area, project switcher, global search, notification bell, profile avatar.

### 3.2 Behavior rules
- Chat panel is collapsible and resizable. When hidden, the board takes the full width.
- Sidebar has two states: full (icon and text) and collapsed (icons only with tooltips).
- Task card opens a side drawer (details) without closing the chat.
- On mobile widths there is no split view. Use bottom tabs: Tasks, Chat, Projects, Profile.
- Keyboard first: Ctrl+K command palette, and basic shortcuts.

### 3.3 Design direction (light SaaS)
- Light surfaces: white and very light gray backgrounds, thin neutral borders, soft shadows.
- One primary accent color (a calm blue or indigo), used sparingly for primary actions and active states.
- Semantic colors only for status: success, warning, danger, info. Never rely on color alone, pair with label or icon.
- Typography: Inter, clear hierarchy, comfortable line height.
- 4 and 8 px spacing grid. Rounded corners 8 to 12 px.
- Icons: a single icon set (Lucide). NO emojis in any UI element, label, button, empty state, toast or notification.
- Design tokens (colors, spacing, radius, shadows, typography) live in one central place.
- All states designed: loading skeletons, empty, error, success, disabled.
- Accessibility: keyboard navigation, visible focus, ARIA labels, contrast at least WCAG AA.
- Note on user-generated text: people may type emojis in messages. That is their content and is not blocked. The application interface itself uses none.
- Note on reactions: because the UI uses no emoji, message reactions use a fixed set of icon-based reactions (for example thumbs up, check, heart, flag, eye) rendered as icons.

---

## 4. Sidebar structure

Top (fixed):
- Home (dashboard)
- My Tasks (my assigned tasks across projects)
- Personal Space (Sticky Notes: `/personal`)
- Messages (Phase 2: DMs, groups, personal AI) with unread badge
- Inbox / Notifications
- Search (Ctrl+K)

Projects section (most important):
- Pinned (per user favorites)
- Recent (last 5 opened)
- All Projects, grouped into folders (project groups)
- Each project expands to sub menus: Board, Files, Members, Settings (Vault added in Phase 2)
- Each project shows its icon and color (Admin editable) and an unread badge

Bottom:
- People / Team
- Admin Panel (Admin only): Users, Invitations, Roles, Projects, Audit logs, Settings

Easy project access features:
1. Global search and command palette (Ctrl+K) for projects, tasks, messages, files, people.
2. Project switcher in the navbar.
3. Pin and favorite.
4. Recent projects.
5. Unread badges.

---

## 5. Roles and permissions

### 5.1 Model
Permissions are fixed building blocks. A role is a bundle of permissions. Nothing is hardcoded per role name in application logic.

- Org role: one per user. Controls organization-wide permissions (create projects, admin panel, invitations, roles).
- Project role: one per user per project (stored on the project membership). Controls what the user can do inside that project. The same user can have different roles in different projects.
- System roles: Admin, Manager, Member. System roles cannot be deleted or renamed.
- Admin role is locked: its permissions cannot be modified or reduced.
- Default roles (Manager, Member) are editable: Admin can customize their permission sets. A "Reset to default" action restores their initial factory permission sets.
- Custom roles are created by Admin through a permission checklist, and can be edited, renamed, or deleted (when no users are assigned). Custom roles appear identically to system roles across all UIs: Admin Users list, role filter dropdowns, role assignment dialogs, and invitation pickers.
- Locked permissions: only Admin has them and they can NEVER be assigned to any non-Admin role (enforced in database RLS/triggers and server API validation):
  - `org.roles.manage` (role management)
  - `vault.edit`, `vault.delete` (Phase 2 Vault sensitive operations)
- Role modification safeguards:
  - Changing a role's permissions shows a confirmation modal indicating the exact count of affected users.
  - Audit logging records the exact permission diff (`permissions_added`, `permissions_removed`).
  - Active sessions of all users with that role are invalidated immediately, forcing token refresh on the next request.
- The last Admin can never be demoted, disabled or deleted.
- Admin can view and manage every project. For AI scope purposes (Phase 2), membership still means explicit membership (Admin gets no hidden extra data access in the AI).
- All permission checks are enforced in the database (RLS) and again in server endpoints. The UI only hides buttons for convenience.

### 5.2 Permission matrix

Yes = allowed. No = not allowed. Locked = Admin only and not assignable to any other role. Config = Admin decides (editable for Manager, Member, and Custom roles).

| Permission | Admin | Manager | Member | Custom |
|---|---|---|---|---|
| Invite new users (`org.invitations.manage`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Create and edit roles (`org.roles.manage`) | Locked | No | No | No |
| View audit logs (`org.audit.view`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Manage organization settings (`org.settings.manage`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Manage users (`org.users.manage`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Create project (`project.create`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Edit project (`project.edit`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Archive project (`project.archive`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Add/remove project members (`project.members.manage`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Create tasks (`task.create`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Edit tasks (`task.edit`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Assign tasks to others (`task.assign`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Assign tasks to oneself (`task.self_assign`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Can be assigned to tasks (`task.assignable`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Delete tasks (`task.delete`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Delete own tasks (`task.delete_own`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Read and send chat (`chat.read`, `chat.send`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Edit/delete own chat message (`chat.message.edit_own`, `chat.message.delete_own`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Delete any message (`chat.message.delete_any`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Pin chat message (`chat.message.pin`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Upload files (`file.upload`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Delete own file (`file.delete_own`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Delete any file (`file.delete_any`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Use @ai (Phase 2: `ai.use`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Turn AI on/off per project (Phase 2: `ai.project.toggle`) | Yes | Config (Default: Yes) | Config (Default: No) | Config |
| Vault view (Phase 2: `vault.view`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Vault add (Phase 2: `vault.add`) | Yes | Config (Default: Yes) | Config (Default: Yes) | Config |
| Vault edit (Phase 2: `vault.edit`) | Locked | No | No | No |
| Vault delete (Phase 2: `vault.delete`) | Locked | No | No | No |
| View vault log (Phase 2: `vault.log.view`) | Yes | Config (Default: No) | Config (Default: No) | Config |
| Change own profile and photo | Yes | Yes | Yes | Yes |

### 5.3 Permission key catalog (single source of truth)
This catalog is defined once, seeded into the database, and shared with the frontend through `@project-hub/shared`.

Organization scope:
- `org.settings.manage`
- `org.users.view`, `org.users.manage`, `org.users.disable`
- `org.invitations.manage`
- `org.roles.manage` (locked to Admin)
- `org.audit.view`
- `project.create`

Project scope:
- `project.view`
- `project.edit`
- `project.archive`
- `project.members.manage`
- `project.settings.manage`
- `task.create`, `task.edit`, `task.delete`, `task.delete_own`
- `task.assign` (assign tasks to others)
- `task.self_assign` (assign tasks to self)
- `task.assignable` (eligible to be assigned tasks)
- `chat.read`, `chat.send`
- `chat.message.edit_own`, `chat.message.delete_own`, `chat.message.delete_any`, `chat.message.pin`
- `file.upload`, `file.delete_own`, `file.delete_any`

Phase 2 keys:
- `vault.view`, `vault.add`, `vault.edit` (locked), `vault.delete` (locked), `vault.log.view`
- `ai.use`, `ai.project.toggle`, `ai_assistant.use`
- `dm.create`, `group.create`

### 5.4 Task Assignment Rules
- Assignee selection validates that candidate members hold `task.assignable`.
- Users with only `task.self_assign` can add/remove themselves, but cannot add/remove others.
- Users with `task.assign` can assign/unassign any eligible member.
- When removing a member from a project or disabling a user, an explicit prompt offers:
  1. Reassign all open tasks to another designated member.
  2. Unassign all open tasks.
- Kanban and List views provide a one-click "Assigned to me" filter.

---

## 6. Messaging

### 6.1 Project chat (right panel of every project)
- One main channel auto-created per project. Optional sub channels later.
- Threads and replies.
- Mentions of people, and channel-wide mention.
- Icon-based reactions.
- Edit and delete own messages. Deleted messages show a placeholder and are kept in the audit trail.
- Typing indicator, online status, read state and unread counts.
- Pin message.
- Rich text: bold, lists, links, code block.
- Link preview cards (server-side fetch with SSRF protection).
- Message to task: convert any message into a task. Task links pasted in chat render as cards. Task status changes can post system messages.
- Attachments: images (inline preview), audio (in-app player, voice note recording), documents, meeting recordings (video or audio with player).
- Search inside chat.

### 6.2 Notifications and email
- In-app bell with realtime updates.
- Email for invitations and alerts:
  - Production-ready SMTP adapter via Nodemailer supporting Google Workspace / Gmail App Password or custom SMTP relay.
  - Validated environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`.
  - Invitation creation offers Admin a clear dual choice: "Send email invitation" (direct SMTP delivery) or "Copy invite link" (manual distribution).
  - Real error reporting: if SMTP sending fails, the system presents the exact error message, retains the invitation token for immediate manual copy, and writes an audit log entry.
- Browser push through PWA.
- Per-user preferences (everything, mentions only, none).
- Due-soon reminders through a scheduled job.

### 6.3 Messages menu (Phase 2)
Layout: conversation list on the left, chat window on the right.

List sections:
1. AI Assistant (pinned on top, distinct style, every user has exactly one, cannot be deleted)
2. Direct messages
3. Groups
4. Search and New message

Rules:
- Only invited company users can message each other.
- A DM is visible only to its two people. A group only to its members. Enforced by RLS.
- Admin cannot read DMs. This is a privacy default. Any compliance exception must be a conscious company policy decision, never silent.
- Group creator is group admin (add or remove members, rename). Members can leave.
- Mute and block.
- Same upload pipeline as project chat, access based on conversation membership.
- @ai does not work in DMs or groups. AI lives only in project channels and the AI Assistant conversation.
- Deactivated users: messages stay, name shows as Deactivated user, access removed.

---

## 7. Files

- Storage behind an interface so the provider can change (Cloudflare R2 recommended, S3 compatible, presigned uploads).
- Private storage only. Access through short-lived signed URLs. No permanent public links.
- Upload directly from the browser to storage using signed upload URLs or resumable upload. Large files never pass through the Next.js server (hosting body limits).
- Allowlist of file types and per-type size limits. Verify actual content type, not only extension.
- Block executable files. Treat SVG and HTML uploads as dangerous. Serve non-media files as downloads.
- Random storage names. Original name kept in the database only.
- Images: resize and compress in the browser before upload, strip metadata (EXIF, location).
- Virus scanning: not available for free at a good quality level. Phase 1 relies on strict allowlist, download-as-attachment, and isolated storage domain. Add a scanner later.
- Quotas per user and per project. Retention policy to be decided.
- Files tab per project: every upload from chat and tasks in one place with filters (images, audio, recordings, documents) and preview.
- Meeting recordings are large. If storage is limited, apply a size cap and allow a link (for example a shared drive link) with a preview card.

---

## 8. AI (Phase 2)

Provider: Groq. The API key lives only in server environment variables, never exposed to the browser.

### 8.1 @ai in project channels
- Anyone in the project can write @ai followed by a question. The AI replies in the channel as a bot user with a clear AI badge, streaming the answer.
- Works only inside project channels. The backend rejects it in DMs and groups.
- Context is only that project: recent messages, tasks, project description, file names.
- A project admin or manager can switch AI off for the project.

### 8.2 Personal AI Assistant (Messages menu)
- Answers only about the projects assigned to the user.
- Example questions: what is due today, status of Project X, what is overdue, what I completed this week.

### 8.3 Hard boundaries (enforced in code, cannot be bypassed by prompts)
1. The project scope is calculated on the server from the user's real memberships. Never from the user's message or from any request parameter.
2. Removing a user from a project removes it from AI scope immediately. No stale caches or summaries.
3. The AI can see: tasks, project channel messages, file metadata of the user's projects, only where the user has permission.
4. The AI can never see: Vault, any DM or group conversation (not even the user's own), other projects, admin data.
5. No shared cache of AI answers between users.
6. Admin gets no special AI scope beyond explicit membership.

### 8.4 Soft guards
- System prompt: answer only from the supplied project data, say so when the data is missing, refuse general or off-topic requests politely.
- Text inside messages, tasks and files is treated as data, never as instructions (prompt injection defense).
- Prompts alone are not a guarantee. The real protection is that out-of-scope data is never sent to the model.

### 8.5 Free tier handling
- Per-user per-minute limit, per-user daily limit, and a global daily cap.
- When the provider limit is hit, show a clear friendly message.
- Keep context small: last 20 to 30 messages plus a task summary.
- AI output is sanitized like any chat message.
- Personal AI history is private to the user. Admin sees usage counts and audit metadata only, not content. The company must know that chat content is sent to the AI provider.
- Audit record of which project IDs were in scope for each AI request.

---

## 9. Vault (Phase 2)

One Vault tab per project for shared credentials (any platform).

Rules:
- All project members can view and add entries.
- Edit and delete are Admin only, and these two permissions are locked.
- Delete is soft delete into a recycle bin, with a separate permanent-delete step.
- Every edit creates a version in history.

Security:
- Passwords and notes are never stored in plain text. Use application-level envelope encryption (AES-256-GCM). The encryption key lives in server secrets, not in the database. Keep an offline backup of the key. If the key is lost, the vault is lost.
- The list API never returns passwords. Decryption happens only on the server when a user explicitly reveals or copies.
- Step-up authentication (password or 2FA again) before reveal, and a short idle timeout.
- Auto-hide after 10 to 15 seconds. Copy action with clipboard clear reminder.
- Full access log: who revealed, copied, edited, deleted, and when.
- Passwords never appear in logs, error reports, search index, chat or AI context.
- Vault content is excluded from global search.

Fields: platform name, URL, username, password, notes, tags, created by, updated by.

---

## 10. Database structure

Row Level Security is enabled on every table. Default is deny.

Identity and access:
- profiles: id (same as auth user), full name, avatar path, designation, timezone, status (active or disabled), org role, last seen
- roles: name, is system, is locked, description
- permissions: key, group, scope (org or project), is assignable
- role_permissions: role to permission
- invitations: email, org role, preset projects, token hash (never the raw token), expiry, accepted time, revoked time, invited by

Projects:
- project_groups: sidebar folders
- projects: name, description, icon type and value, color, group, archived flag
- project_members: project, user, project role, added by
- user_project_prefs: pinned, last opened, muted (per user)
- project_settings: feature switches such as AI on or off, file limits

Tasks:
- task_statuses: per project columns and their order
- tasks: project, status, key number (for example PRJ-12), title, description, priority, due date, position, creator
- task_assignees, task_watchers
- task_checklist_items (subtasks)
- task_labels, task_label_links
- task_comments
- task_activity

Chat:
- channels: type (project now; dm, group, ai_assistant in Phase 2)
- channel_members: for DMs and groups
- messages: channel, sender or AI flag, body, parent message (threads), edited and deleted time, linked task, pinned
- message_reactions, message_mentions
- channel_reads: last read position
- link_previews: cached previews

Files:
- files: project, uploader, message or task link, storage key, original name, content type, size, status, deleted flag

Notifications and system:
- notifications, notification_prefs, push_subscriptions
- audit_logs: actor, action, entity, entity id, metadata, ip, time
- org_settings: company name, logo, timezone, working days, personal space limits (max notes, max chars, retention days)

Personal Space:
- personal_notes: id, user_id (FK to profiles), title, content_type ('text' | 'checklist'), content, checklist_items (jsonb), color, is_pinned, is_archived, is_deleted, deleted_at, position, version (optimistic lock), created_at, updated_at
- Strict owner-only RLS: `auth.uid() = user_id`. Zero Admin or Manager bypass. Excluded from global search. Audit logs store action and note ID only (never note text).

Phase 2 additions:
- ai_requests (user, project, scope project IDs, tokens, time), optional ai_threads
- vault_entries, vault_entry_versions, vault_access_log
- user_blocks

Relations in short: user to many projects (through project_members), each project owns tasks, a channel, files and vault entries. A message may belong to a thread and may link to one task. Personal notes belong strictly to individual users.

---

## 11. Screens and flows

A. Authentication
1. Accept invitation: link opens, email is shown and not editable, user sets password, optional photo.
2. Login: email and password, then 2FA step (mandatory for Admin).
3. Forgot and reset password.
4. Clear pages for expired, used or revoked invitations.

B. Shell: sidebar, navbar and content area on every screen.

C. Home: my tasks today, overdue, pinned projects, recent activity, unread mentions.

D. My Tasks: all my tasks across projects with filters (project, due date, priority).

E. Project workspace (main screen): board and chat side by side. Tabs: Board, Files, Members, Settings (Vault in Phase 2). View switcher: Board, List (Calendar later). Task drawer for details. Includes "Assigned to me" filter.

F. Chat panel: message list, composer with attach, mention, link, voice note. Hover actions: reply, react, create task, pin, edit, delete.

G. Files tab: all project files with filters and preview.

H. Members tab: project members, roles, add and remove. Member removal prompts for task reassignment or unassigning.

I. Project settings: name, description, icon, color, group, archive.

J. Global search (Ctrl+K): only results the user may see (excludes Personal Space and Vault).

K. Notifications: bell dropdown and full page.

L. Profile and settings: photo (client-side resize, metadata stripping), name, designation, timezone, notification preferences, password change, 2FA with recovery codes, active sessions with revocation.

M. Admin Panel (Admin only):
1. Users: user list, role changer (includes custom roles), disable user, offboarding with task reassignment.
2. Invitations: create (SMTP email sending OR manual copy link), resend, revoke.
3. Roles: system roles (Admin locked; Manager and Member editable with "Reset to default"), custom role creator/editor, affected user confirmation, permission diff audit.
4. Projects: all projects list, icon/color editing, archive/unarchive.
5. Audit logs: search and filter by actor, action, date.
6. Organization settings: company name, logo, personal space limits.

N. Personal Space (`/personal`):
1. Available to all active roles without permission gating. Disabled users lose access immediately.
2. Warm off-white canvas (`#FAF9F6`) with distinctive rounded coral floating/header add button (`#FF6B6B`) containing a plus icon.
3. Instant note creation via button or shortcut. Debounced autosave (500ms) with save status indicator.
4. Plain text or checklist mode with completed strike-through.
5. Pastel color tokens meeting WCAG AA contrast.
6. Pin, archive, soft-delete to trash with 30-day restore, drag-to-reorder, grid/list view toggle.
7. In-space instant search and color filter.
8. Convert note to company project task (selects destination project, column, assignees).
9. Pure plain text rendering (no HTML/script execution).
10. Strict owner-only privacy enforced by RLS.

O. Phase 2 screens: Vault tab, Messages menu (DMs, groups, AI Assistant), project AI settings.

---

## 12. Security requirements

Authentication
- Public signup is disabled in every layer.
- Invitations: single-use, time-limited, token stored only as a hash, revocable.
- Strong password policy. 2FA (TOTP) mandatory for Admin, available to all. Recovery codes.
- Rate limiting and lockout on login, invitation, password reset, upload and AI endpoints.
- Short-lived sessions with refresh rotation. Cookies HttpOnly, Secure, SameSite. Session list and sign out everywhere.

Authorization
- RLS on every table, default deny.
- Server endpoints re-check permissions. UI hiding is not security.
- Every request validates access to the exact project, task, message or file (protection against IDOR: changing an ID in the URL to read someone else's data).
- The service role key is used on the server only, never reaches the browser, never in public environment variables.

Data and input
- HTTPS only. Input validation on every endpoint with schemas. Parameterized queries only.
- Chat and AI output sanitized (XSS). Content Security Policy and standard security headers. CSRF protection. Strict CORS.
- File upload rules from section 7. Link preview fetching blocks private and internal network addresses (SSRF).
- No secrets, tokens or passwords in logs or error reports. Error messages do not leak internals.

Operations
- Audit log for sensitive actions: invitations, role changes, project create, archive or delete, user disable, file delete, settings changes.
- Soft delete for important records. Regular backups and a tested restore.
- Dependency updates and scanning. Secret scanning with gitleaks (private repo secret scanning on GitHub is paid).
- Separate environments: development, staging, production, with versioned database migrations.
- Automated RLS tests for every role. Manual IDOR tests before launch.
- Admin offboarding flow: disable account, revoke sessions, reassign tasks, keep history.

---

## 13. Tech stack (free)

Frontend (web)
- Next.js 15 (App Router, Port 4321) with TypeScript (strict)
- Tailwind CSS and shadcn/ui (Light theme only, Inter font, design tokens)
- TanStack Query / SWR (client cache with Supabase Realtime-driven cache invalidation)
- TanStack Virtual (long chat lists), TanStack Table
- React Hook Form and Zod (forms and validation)
- dnd-kit (Kanban and sticky notes drag and drop)
- TipTap (rich text composer)
- cmdk (command palette)
- Lucide icons (no emojis anywhere)
- Browser MediaRecorder for voice notes

Backend and data
- Supabase Free: Postgres, Auth (email and password, TOTP 2FA, session revocation), Realtime, RLS
- Performance architecture:
  - Explicit b-tree indexes on all foreign keys, lookup join tables, and RLS filter columns
  - Statement-level RLS optimization via `EXISTS` subqueries (zero per-row recursive function overhead)
  - React Server Components parallel data fetching (`Promise.all`)
  - Cursor pagination for high-volume endpoints (messages, activity, tasks)
- Postgres full-text search for search (no separate search service)
- pg_cron and Supabase Edge Functions for scheduled jobs (due reminders, cleanup)
- Next.js route handlers as a thin, token-authenticated API layer for sensitive logic
- Upstash Redis free tier strictly scoped for rate limiting, settings caching, and permission catalogs

Files, email, AI
- Supabase Storage (behind storage interface, ready for Cloudflare R2 migration; size limits & allowlists)
- Nodemailer SMTP adapter (supports Google Workspace / Gmail App Password or custom SMTP relay)
- Resend free tier supported as optional provider adapter
- Groq for AI (Phase 2), Vercel AI SDK for streaming and provider abstraction
- Web Push (PWA) for notifications
- AES-256-GCM envelope encryption for the Vault (Phase 2)

Hosting
- Development: Local Next.js on port 4321
- Staging / Production: Cloudflare Pages / Workers or Vercel Pro (when company approves)

Quality and DevOps
- GitHub private repo, GitHub Actions, Dependabot, gitleaks
- Vitest (unit), Playwright (end to end), pgTAP through Supabase CLI (RLS tests)
- ESLint, Prettier, Husky
- Supabase CLI for migrations and pgTAP RLS test suite
- Automated weekly database backup job and keep-alive workflow via GitHub Actions

---

## 14. Free tier limits and watch list

Limits below are from general knowledge. Verify each pricing page before launch.

Not free:
- A domain name (small yearly cost). Needed for reliable email invitations. Free fallback: Admin copies the invite link and shares it manually.
- Commercial hosting on Vercel (Hobby is non-commercial).

Likely to hit first:
1. Database size (about 500 MB on Supabase Free). Keep files out of the database, keep messages lean, define a retention policy, archive old messages.
2. Realtime message quota. One message counts once per receiver. Subscribe only to the open channel, throttle typing indicators, no presence for everyone.
3. Supabase project pause on inactivity. Use a small keep-alive job.
4. No automatic backups on free. Build weekly export and test restore.
5. Storage for recordings. Enforce size caps and quotas, or use external links.
6. Groq rate limits. Per-user and global caps with friendly fallback messages.
7. Email daily quota. Fine for invitations, not for bulk digests.

Upgrade path when needed: Supabase Pro first, then hosting, then storage. Architecture stays the same.

Feasibility estimate: Phase 1 about 95 percent free. Whole product at 500 users about 85 to 90 percent free.

---

## 15. App-ready architecture (for the future mobile app)

1. API first. Sensitive operations live behind token-authenticated endpoints, not only in web server actions or cookies.
2. RLS is the source of truth, so any frontend (web or mobile) is safe.
3. Monorepo with pnpm and Turborepo:
   - apps/web: Next.js app
   - apps/mobile: empty for now
   - packages/shared: types, validation schemas, permission catalog, constants, API wrapper
   - supabase: migrations, RLS policies, tests, seed data
   - docs: plans and decisions
4. Separate UI from business logic (services and hooks, not inside components).
5. Consistent URL structure (for example /projects/:id/board). It maps to mobile deep links.
6. Versioned API (/api/v1).
7. Cursor pagination and idempotent writes (retry safe on weak mobile networks).
8. Files only through presigned URLs.
9. Notification abstraction: Web Push now, FCM or APNs later, one internal event system.
10. Responsive design and installable PWA from Phase 1.
11. Mobile path later: quick option is wrapping the PWA with Capacitor. Better option is React Native with Expo reusing the shared package.

---

## 16. Roadmap

Phase 1 (MVP): invitation-only auth, roles and custom roles, projects with editable icons, sidebar and search, Kanban and List, task drawer, project chat with uploads, Files tab, notifications, profile, Admin panel, audit logs, PWA.

Phase 2: Messages menu (DMs, groups, personal AI Assistant), @ai in project chat, Vault, teams or departments, calendar view, push polish.

Phase 3: reports and dashboards, recurring tasks, dependencies, custom fields, templates, integrations, exports, language options, optional meeting transcript summaries.

Also missing items to add along the way: teams or departments (bulk add), announcements channel (Admin posts, others react), organization settings, onboarding guide and empty states, session management, 2FA recovery, key rotation plan for the Vault, monitoring, retention policy, restore drill, launch security checklist.

---

## 17. Edge cases to remember

- User has no projects: the AI and Home must show a real empty state.
- User removed from a project: immediate loss of access, including AI scope and search results.
- User leaves the company: disable, revoke sessions, reassign tasks, keep history, show as Deactivated user.
- Last Admin protection.
- Expired, used or revoked invitation links.
- Provider limit reached (AI, email): clear message, no silent failure.
- Large uploads failing midway: resumable or retry with clear feedback.
- A mention of someone outside the conversation must not notify them or reveal content.

---

## 18. Status of Key Decisions

1. **Hosting**: Local development on port 4321. Production on Cloudflare Workers/Pages or Vercel Pro.
2. **Files provider**: Supabase Storage for Phase 1, behind the storage interface for future Cloudflare R2 migration.
3. **Email provider**: SMTP via Nodemailer supporting Google Workspace / Gmail App Password, with manual copy-link toggle.
4. **App Name & Branding**: Project Hub, Hydrated Studio. Text mark/SVG icon, editable via Org Settings.
5. **Personal Space**: Resolved as dedicated `/personal` Sticky Notes space (plain text & checklist, drag & drop, pastel tokens, WCAG AA, strict owner-only RLS).
6. **Port**: Standardized to `4321`.
7. **Default Roles**: Admin (locked), Manager and Member (editable permission sets with "Reset to default"). Custom roles visible everywhere.
8. **Task Assignment**: Granular permissions `task.assign`, `task.self_assign`, `task.assignable`, plus member removal reassignment flow.
9. **Performance Architecture**: Foreign key indexing, statement-level RLS, RSC parallel fetching, SWR query caching + Realtime invalidation, scoped Upstash Redis.
