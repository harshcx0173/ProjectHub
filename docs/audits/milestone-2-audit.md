# Milestone 2 Audit: Shell, Projects and Navigation

**Date:** 2026-10-28  
**Scope:** Milestone 2 — 3-Zone Shell Layout, Top Navbar, Collapsible Sidebar, Projects Management, Admin-Only Appearance Controls, and Postgres Full-Text Search  
**Auditor:** Antigravity Full-Stack & Application Security Pair  

---

## 1. Code Audit
- **Shell Architecture:**
  - Standardized unified layout under `src/app/(workspace)/layout.tsx` hosting `WorkspaceShell`.
  - Top `Navbar` with brand identifier, active project switcher dropdown, global search trigger (`Ctrl+K`), notifications bell, and user avatar dropdown with role indicators.
  - Collapsible `Sidebar` with full text/icon view and collapsed icon-only view with tooltips.
  - Section hierarchy: Fixed top menus (Home, My Tasks, Inbox, Search), Pinned projects (with pin/unpin toggles), All Projects grouped by folder (`project_groups`), and Fixed bottom menus (People/Team, Admin Panel).
  - Admin Panel link strictly conditioned on `userProfile?.orgRole === 'Admin'` — completely absent for non-Admins.
- **Type Safety & Cleanliness:**
  - Strict TypeScript check across monorepo passed with **0 errors**.
  - No dead imports, explicit types on all props and API responses.

---

## 2. Security & Permission Audit
- **Project Isolation & IDOR Protection:**
  - `projects` RLS policy enforces that non-Admins can only `SELECT` projects where they have a confirmed row in `public.project_members`.
  - Direct API queries attempting to fetch another project's settings or members are blocked at the database level by RLS.
- **Admin-Only Field Protection (Database Trigger):**
  - Project icon (`icon_type`, `icon_value`), accent color (`color`), and archive status (`is_archived`) are locked to Admins.
  - Enforced not just in the UI, but in Postgres via `tr_project_admin_field_protection` trigger on `public.projects`. Non-admins attempting direct API tampering are rejected with `403 FORBIDDEN` and database exception.
- **Search Scoping (Postgres Full-Text Search):**
  - `global_search(p_query)` RPC function queries projects using `can_view_project(auth.uid(), project_id)`.
  - Search results never leak projects, tasks, or files belonging to workspaces where the user is not an explicit member.

---

## 3. UI & Design System Audit
- **Light Theme Compliance:**
  - Professional SaaS appearance matching design tokens in `globals.css`: clean white surfaces (`#FFFFFF`), light gray backgrounds (`#F9FAFB`), thin neutral borders (`#E5E7EB`), soft shadows.
  - **Zero emojis** across all components. All icons rendered via Lucide icons (`Folder`, `Briefcase`, `Rocket`, `Zap`, `Shield`, `Terminal`, `Globe`, `Cloud`, `Database`, `Layout`, `Code2`, `Cpu`, `Layers`, `Target`, `Boxes`, `Sparkles`).
  - Project color dots with accessible contrast.
- **State Coverage:**
  - Empty states for zero pinned projects and zero total projects with contextual calls to action.
  - Command palette keyboard navigation (Arrow Up/Down, Enter, Esc).
  - Project creation modal with validation and duplicate project key prevention.

---

## 4. Test Suite Execution
- `pnpm test` (Turborepo):
  - 12 unit tests passed (catalog, permissions, env validation, cryptographic utilities, TOTP generation).
- `pnpm type-check`: 0 errors across `@project-hub/shared` and `@project-hub/web`.
- Production Build: Full route compilation across workspace routes.

---

## 5. What Was Fixed During Milestone 2
1. Added `appName` to `OrgSettings` shared model and mapped fallback from settings table.
2. Removed duplicate root route collision by consolidating `src/app/page.tsx` into `src/app/(workspace)/page.tsx`.
3. Added `dynamic-icon.tsx` to safely resolve and render Lucide icons by name without unsafe `eval`.

---

## 6. Next Steps & Readiness for Milestone 3
- Database migration `20261028000003_projects_and_search.sql` ready to apply to development database.
- Proceed to **Milestone 3: Task Board (Kanban drag-and-drop, List view, auto-keys PRJ-101, side drawer, subtasks/checklists)**.
