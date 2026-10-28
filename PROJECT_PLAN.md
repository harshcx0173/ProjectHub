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
| Roles | Admin, Manager, Member, plus custom roles created by Admin |
| Layout | Left: sidebar. Center: task board (per project). Right: project chat. Top: navbar with logo area, search, bell, avatar |
| Project icon | Editable by Admin only |
| Messaging | Microsoft Teams style, no calling features |
| Profile | Users can change their own profile picture |
| Chat uploads | Images, audio, links, documents, meeting recordings |
| @ai in project chat | Anyone can use it, only inside project channels, only about that project |
| Messages menu | Separate sidebar menu: user-to-user DMs and groups, plus a personal AI Assistant limited to the user's assigned projects |
| Vault | One Vault tab per project. All project members can view and add. Only Admin can edit and delete |
| AI provider | Groq (existing API key), free tier |
| Stack | Next.js + Supabase |
| Hosting | Free for now. Vercel Hobby for development. Production on a commercially allowed free host (Cloudflare) or Vercel Pro later |
| Platform | Web now. Mobile app later (structure must allow it) |
| UI | Modern, professional SaaS, LIGHT theme only, no dark colors, no emojis anywhere in the UI, proper icons and elements only |

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
- System roles (Admin, Manager, Member) cannot be deleted. The Admin role is locked.
- Custom roles are created by Admin through a permission checklist.
- Some permissions are Locked: only Admin has them and they cannot be assigned to any custom role (role management, Vault edit, Vault delete).
- The last Admin can never be demoted, disabled or deleted.
- Admin can view and manage every project. For AI scope purposes, membership still means explicit membership (Admin gets no hidden extra data access in the AI).
- All permission checks are enforced in the database (RLS) and again in server endpoints. The UI only hides buttons for convenience.

### 5.2 Permission matrix

Yes = allowed. No = not allowed. Locked = Admin only and not assignable. Config = Admin decides when building a custom role.

| Permission | Admin | Manager | Member | Custom |
|---|---|---|---|---|
| Invite new users | Yes | No | No | No |
| Create and edit roles | Locked | No | No | No |
| Create project | Yes | Yes | No | Config |
| Edit project name, icon, color | Yes | No | No | No |
| Archive or delete project | Yes | No | No | No |
| Add or remove project members | Yes | Yes (own projects) | No | Config |
| Create and edit tasks | Yes | Yes | Yes | Config |
| Delete tasks | Yes | Yes | Own only | Config |
| Read and send project chat | Yes | Yes | Yes | Config |
| Edit or delete own message | Yes | Yes | Yes | Config |
| Delete any message (moderation) | Yes | Yes | No | No |
| Upload files | Yes | Yes | Yes | Config |
| Delete any file | Yes | Yes | Own only | No |
| Use @ai (Phase 2) | Yes | Yes | Yes | Yes |
| Turn AI on or off per project (Phase 2) | Yes | Yes | No | No |
| Vault view (Phase 2) | Yes | Yes | Yes | Yes |
| Vault add (Phase 2) | Yes | Yes | Yes | Yes |
| Vault edit (Phase 2) | Locked | No | No | No |
| Vault delete (Phase 2) | Locked | No | No | No |
| View vault access log (Phase 2) | Yes | No | No | No |
| View audit logs | Yes | No | No | No |
| Change own profile and photo | Yes | Yes | Yes | Yes |

### 5.3 Permission key catalog (single source of truth)
This catalog is defined once, seeded into the database, and shared with the frontend through one shared package. No scattered permission strings.

Organization scope:
- org.settings.manage
- org.users.view, org.users.manage, org.users.disable
- org.invitations.manage
- org.roles.manage (locked)
- org.audit.view
- project.create

Project scope:
- project.view
- project.edit (name, description, icon, color)
- project.archive
- project.members.manage
- project.settings.manage
- task.create, task.edit, task.assign, task.delete, task.delete_own
- chat.read, chat.send
- chat.message.edit_own, chat.message.delete_own, chat.message.delete_any, chat.message.pin
- file.upload, file.delete_own, file.delete_any

Phase 2 keys:
- vault.view, vault.add, vault.edit (locked), vault.delete (locked), vault.log.view
- ai.use, ai.project.toggle, ai_assistant.use
- dm.create, group.create

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

### 6.2 Notifications
- In-app bell with realtime updates.
- Email for invitations and optional digests.
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
- org_settings: company name, logo, timezone, working days

Phase 2 additions:
- ai_requests (user, project, scope project IDs, tokens, time), optional ai_threads
- vault_entries, vault_entry_versions, vault_access_log
- user_blocks

Relations in short: user to many projects (through project_members), each project owns tasks, a channel, files and vault entries. A message may belong to a thread and may link to one task.

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

E. Project workspace (main screen): board and chat side by side. Tabs: Board, Files, Members, Settings (Vault in Phase 2). View switcher: Board, List (Calendar later). Task drawer for details.

F. Chat panel: message list, composer with attach, mention, link, voice note. Hover actions: reply, react, create task, pin, edit, delete.

G. Files tab: all project files with filters and preview.

H. Members tab: project members, roles, add and remove.

I. Project settings: name, description, icon, color, group, archive.

J. Global search (Ctrl+K): only results the user may see.

K. Notifications: bell dropdown and full page.

L. Profile and settings: photo, name, designation, timezone, notification preferences, password, 2FA, active sessions.

M. Admin Panel (Admin only): Users (role change, disable, offboarding), Invitations (create, resend, revoke, copy link), Roles (system roles locked, custom role builder), Projects (all projects, icon edit, archive), Audit logs, Organization settings.

N. Phase 2 screens: Vault tab, Messages menu (DMs, groups, AI Assistant), project AI settings.

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
- Next.js (App Router) with TypeScript (strict)
- Tailwind CSS and shadcn/ui
- TanStack Query (data cache), TanStack Virtual (long chat lists), TanStack Table
- React Hook Form and Zod (forms and validation)
- dnd-kit (Kanban drag and drop)
- TipTap (rich text composer)
- cmdk (command palette)
- FullCalendar or react-big-calendar (calendar view, later)
- Recharts (reports, later)
- Lucide icons, Inter font
- Browser MediaRecorder for voice notes

Backend and data
- Supabase Free: Postgres, Auth (email and password, TOTP 2FA, optional Google login), Realtime, RLS
- Postgres full-text search for search (no separate search service)
- pg_cron and Supabase Edge Functions for scheduled jobs (due reminders, cleanup)
- Next.js route handlers as a thin, token-authenticated API layer for sensitive logic
- Upstash Redis free tier for rate limiting (fallback: a Postgres table)

Files, email, AI
- Cloudflare R2 for files (about 10 GB free, S3 compatible, presigned URLs)
- Resend free tier for email (needs a domain)
- Groq for AI, Vercel AI SDK for streaming and provider abstraction
- Web Push (PWA) for notifications, later FCM for mobile
- AES-256-GCM envelope encryption for the Vault

Hosting
- Development and staging: Vercel Hobby
- Production for the company: Cloudflare Workers or Pages, or Vercel Pro when the company approves. Vercel Hobby is not allowed for commercial use.
- Keep the code free of Vercel-only features so hosting can move.
- Advanced option: Oracle Cloud Always Free VM (more maintenance).

Quality and DevOps
- GitHub private repo, GitHub Actions, Dependabot, gitleaks
- Vitest (unit), Playwright (end to end), pgTAP through Supabase CLI (RLS tests)
- ESLint, Prettier, Husky
- Supabase CLI for local development and migrations
- Sentry free tier (errors), UptimeRobot or Better Stack free (uptime)
- Figma free or draw.io for wireframes
- Bitwarden free for secure storage of keys and credentials
- Weekly database backup job through GitHub Actions to separate storage

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

## 18. Open decisions

1. Final hosting for production (Cloudflare or Vercel Pro).
2. Files provider for Phase 1 (R2 recommended, or Supabase Storage with small limits).
3. Email: domain available? Otherwise manual invite links.
4. Login: email and password only, or also Google or Microsoft sign in.
5. Retention period for chat and files.
6. App name and branding.
7. Notes to self conversation: yes or no.
8. UI language: English only, or Hindi also.
9. Task fields beyond priority, due date, labels and assignees (estimate, custom fields).
