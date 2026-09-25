# mso-pm — architecture plan

Status: **proposal**. Frontend (design system, shell, screens on sample data) is being
built now. The database schema below is not applied yet — review it first.

Design reference: https://claude.ai/artifact/Mmb594PjtmzfUSUxtsnMNA

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | Server Components render first paint with no client fetch; deploys to Vercel as-is |
| Styling | Tailwind CSS v4, tokens in `globals.css` | Design tokens live in one place; no runtime CSS-in-JS |
| UI primitives | Radix (dialog, dropdown, popover, tabs, tooltip) + own styling | Accessible focus traps and keyboard handling without a component kit's look |
| Icons | lucide-react | Tree-shaken; matches the stroke style in the design |
| Data | Supabase (Postgres + Auth + Storage), `@supabase/ssr` | RLS is the security boundary |
| Client cache | TanStack Query | Fetch once, reuse, optimistic updates, targeted invalidation |
| Validation | Zod, shared by forms and server actions | One schema per entity |
| Drag and drop | dnd-kit (board only, lazy-loaded) | Small, accessible |

**Request path.** Reads and simple writes go browser → Supabase directly (PostgREST,
RLS enforced). No Vercel function sits in the middle, which saves invocations and a hop.
Server Components do the first render of each page. Server actions are used only where
a service key or multi-step transaction is needed (invitations, org creation).

**Supabase region:** `ap-south-1` (Mumbai), project ref `aaxeehcqqduuvxxtwzrl`.
Pin Vercel functions to `bom1` so server renders sit next to the database.

## 2. Routing and active organization

The active organization is in the URL: `/{orgSlug}/...`.

- Links are unambiguous and every page knows its org without extra state.
- `/` redirects to the last-used org (stored on the profile), or to `/onboarding`
  when the user has none.
- The slug is **never** trusted for authorization; RLS checks membership on every row.
- If a user loses access to the org in the URL, the layout redirects to another org
  they belong to, or to onboarding.

```
/login  /signup  /reset-password  /onboarding (create first org)  /invite/[token]
/[org]                      dashboard
/[org]/my-tasks
/[org]/projects             /[org]/projects/[key]/{overview,tasks,board,issues,releases,calendar,docs,activity,settings}
/[org]/issues   /[org]/releases   /[org]/calendar   /[org]/clients   /[org]/team
/[org]/activity /[org]/docs       /[org]/settings/[section]
```

## 3. Folder structure

```
src/
  app/                    routes only: layouts, pages, loading/error files
  components/
    ui/                   Button, Input, Select, Badge, Dialog, Drawer, Sheet, Tabs, Avatar, Toast, EmptyState, Skeleton
    shell/                Sidebar, OrgSwitcher, AppHeader, MobileNav, CommandPalette
  features/
    projects/  tasks/  issues/  releases/  clients/  team/  calendar/  dashboard/  settings/  activity/
      components/         feature UI
      queries.ts          read contracts (explicit column lists)
      mutations.ts        writes + optimistic cache updates
      schema.ts           zod
  lib/
    supabase/             browser client, server client, middleware session refresh
    auth/                 session helpers
    permissions.ts        the ONLY place permission keys are defined and checked
    format.ts             dates, relative time
  mock/                   sample data used until each feature is wired (deleted as it goes)
supabase/
  migrations/             every schema change, numbered
  seed.sql                dev-only demo data (never run in production)
```

## 4. Database schema (proposal)

Every organization-owned table carries `organization_id uuid not null`, has RLS enabled
in the migration that creates it, and is indexed on `organization_id`.

### Global
- `profiles` — id (= auth.users.id), full_name, avatar_path, last_org_id, created_at

### Organization core
- `organizations` — id, slug (unique), name, logo_path, timezone, week_start, archived_at
- `roles` — id, organization_id, name, key, permissions `text[]`, is_system
  (seeded: owner, admin, project_manager, developer, viewer)
- `organization_members` — organization_id, user_id, role_id, status (active/deactivated), joined_at — PK (organization_id, user_id)
- `invitations` — id, organization_id, email, role_id, token_hash, invited_by, expires_at, status, accepted_at

### Configuration (one table, typed by `kind`)
- `options` — id, organization_id, kind, name, color, category, rank, sort_order,
  is_default, is_active, created_at
  - `kind`: project_type, project_status, task_status, task_priority, issue_status,
    issue_severity, release_status, milestone_status
  - `category` gives meaning independent of the name
    (task_status: `not_started | active | blocked | completed`;
    issue_status: `open | active | resolved | closed`) — progress and overdue maths use it
  - `rank` orders priority/severity for sorting
  - Unique `(organization_id, id, kind)` so other tables can reference
    `(organization_id, status_id, kind)`. That composite FK guarantees a task can only
    point at **its own organization's** task statuses — tenant isolation is enforced by
    the schema, not just by RLS.
  - Options in use are archived (`is_active = false`), never deleted.
- `labels` — id, organization_id, name, color, is_active
- Project-level workflow override (later, no rewrite needed): `project_options`
  (project_id, option_id, sort_order, hidden)

### Work
- `clients` — id, organization_id, name, company, email, phone, notes, archived_at
- `projects` — id, organization_id, key (e.g. SKR, unique per org), name, description,
  client_id, type_id, status_id, priority_id, start_date, due_date, completed_at,
  repo_url, prod_url, staging_url, next_task_number, created_by, archived_at
- `project_members` — project_id, user_id, organization_id, role_id (nullable = use org role)
- `milestones` — id, organization_id, project_id, name, description, start_date, due_date, status_id
- `releases` — id, organization_id, project_id, version, name, notes, status_id, release_date
- `tasks` — id, organization_id, project_id, number (SKR-142), title, description,
  status_id, priority_id, assignee_id, reporter_id, milestone_id, release_id,
  parent_id, start_date, due_date, estimate_minutes, actual_minutes, sort_order,
  completed_at, created_at, updated_at, deleted_at
- `task_labels` — task_id, label_id, organization_id
- `task_dependencies` — task_id, blocked_by_task_id, organization_id
- `checklist_items` — id, organization_id, task_id, text, done, sort_order
- `issues` — same shape as tasks where shared (number shares the project sequence),
  plus severity_id, environment, steps, expected, actual, related_task_id, resolved_at
- `comments` — id, organization_id, entity_type (task/issue), entity_id, author_id, body, edited_at, deleted_at
- `attachments` — id, organization_id, entity_type, entity_id, storage_path, name, size, mime, uploaded_by
- `documents` — id, organization_id, project_id, title, body (markdown), updated_by, updated_at
- `activity` — id, organization_id, project_id, actor_id, action, entity_type, entity_id,
  changes jsonb (`{"status":["In progress","Review"]}`), created_at — written by triggers
- `notifications` — id, organization_id, user_id, kind, entity_type, entity_id, read_at, created_at

**Deletes.** Projects and orgs archive (`archived_at`), they do not cascade-delete.
Tasks/issues soft-delete (`deleted_at`). Hard delete is a deliberate owner-only action.

## 5. Authentication and authorization

- Supabase Auth, email + password, password reset, email verification.
  Sessions in cookies via `@supabase/ssr`; middleware refreshes them.
- Only the anon/publishable key reaches the browser. The service key stays server-side
  and is used for invitations and org creation only.
- **Permissions are data.** A role is a list of keys like `tasks.update`.
  `lib/permissions.ts` defines the keys once; the UI asks `can('tasks.update')`
  to hide or disable controls, but that is convenience only.
- **Project-level roles.** `project_members.role_id` overrides the org role for that
  project (Admin on one project, Viewer on another).

## 6. RLS strategy

- `security definer` helper functions, `stable`, returning small sets:
  - `my_org_ids()` — orgs where I am an active member
  - `has_org_perm(org_id, perm)`
  - `has_project_perm(project_id, perm)` — project role, else org role
- Policies call them as `(select my_org_ids())` so Postgres evaluates once per query,
  not once per row. Backed by indexes on `organization_members(user_id)` and
  `project_members(user_id)`.
- Every table: `organization_id in (select my_org_ids())` **and** the project/permission
  check for the operation.
- Isolation tests (SQL, run in CI): two orgs, one user in both, a non-member, and one
  user per role. Every table is checked for read/insert/update/delete across orgs and
  with forged IDs.

## 7. Egress rules (Supabase free tier)

- No `select *`. Each screen has a query with an explicit column list in `queries.ts`.
- Dashboard numbers come from one `dashboard_summary(org_id)` SQL function, not raw rows.
- Lists are paginated (25–50), activity and comments load the latest 20 first.
- Org config (all options, labels, my permissions) loads once per org as one RPC and
  is cached; invalidated only when settings change.
- Search is one `search(org_id, q)` RPC using trigram indexes, top 5 per type, 300 ms debounce.
- No polling. Realtime only for my notifications, scoped by `user_id`.
- Attachments load metadata only; files open through short-lived signed URLs.
  Images resized before upload; avatars stored at 128 px.

## 8. Phases

1. Frontend: design tokens, shell, screens on sample data  ← **in progress**
2. Schema + RLS + auth (login, signup, reset, onboarding, org creation with defaults)
3. Projects, clients, members, invitations
4. Tasks: list, board with drag and drop, detail drawer, checklist, labels, dependencies
5. Issues
6. Milestones, releases, calendar
7. Comments, activity, notifications
8. Search, filters, dashboard summary function
9. Mobile pass + performance
10. RLS audit, isolation tests, docs

After each phase: typecheck, lint, RLS tests, check at phone width.
