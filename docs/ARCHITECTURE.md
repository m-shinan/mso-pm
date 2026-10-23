# mso-pm — architecture

Status: **built**. Schema, RLS, auth and every screen are live against Supabase
project `<project-ref>`. See §8 for what is intentionally not built yet.

Design reference: https://claude.ai/artifact/Mmb594PjtmzfUSUxtsnMNA

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, `proxy.ts`) + TypeScript | Server Components render first paint with no client fetch; deploys to Vercel as-is |
| Styling | Tailwind CSS v4, tokens in `globals.css` | Design tokens live in one place; no runtime CSS-in-JS |
| UI primitives | Radix (dialog, dropdown menu, popover) + own styling | Accessible focus traps and keyboard handling without a component kit's look |
| Icons | lucide-react | Tree-shaken; matches the stroke style in the design |
| Data | Supabase (Postgres + Auth), `@supabase/ssr` 0.12, publishable key | RLS is the security boundary |
| Validation | Zod 4 in server actions; the same rules as DB `check` constraints | Bad input is refused twice |
| Tests | Vitest: unit tests + real-database RLS tests | Tenant isolation is proven, not assumed |

**Request path.** Server Components do each page's first render with the user's
session (RLS applies). Writes go browser → Supabase directly (RLS enforced) — no
Vercel function in the middle. After a write the page calls `router.refresh()`
to re-render only the current route's server data. Status changes are
optimistic with rollback and Undo.

**No client cache library.** TanStack Query was planned but not needed: org
configuration loads once per navigation in the org layout (React `cache()`
de-duplicates it within a request) and is handed to a client context, so pickers
never refetch it. Add a cache library only if a screen needs live client-side
refetching.

Server actions are used where the server must do something the browser
shouldn't: sign in/up/out, generating invitation tokens, search.

**Supabase region:** `ap-south-1` (Mumbai), project ref `<project-ref>`.
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
- No polling. Realtime (`postgres_changes`, inserts and updates only) is used in two
  places: the project pages listen to `tasks`, `issues`, `comments` filtered by
  `project_id`, and the shell listens to my `notifications` by `user_id`. A change
  triggers one debounced `router.refresh()`; while the tab is hidden nothing is
  fetched, and one refresh happens when it's shown again (`components/shell/live-refresh.tsx`).
  Realtime applies each table's RLS per subscriber, so nobody receives rows they can't read.
- Attachments load metadata only; files open through short-lived signed URLs.
  Images resized before upload; avatars stored at 128 px.

## 8. What is built, and what is not yet

Built and tested: auth (sign up with email confirmation, sign in, reset, change
password, sign out), organizations (create with agency/minimal defaults, switch,
settings, archive/restore), invitations (hashed one-time links, email-bound,
7-day expiry, revoke), roles and per-project role overrides, projects (create,
edit, members, pin, archive), board and list with optimistic status changes,
task drawer (edit, assign, checklist, comments, delete), issues (report, drawer,
status, comments), releases (create, mark released with drafted changelog),
clients, documents (with a secret-paste warning), calendar, activity log,
in-app notifications, global search, dashboard summary RPC, configurable options
(add, rename, recolour, reorder, default, archive, delete-if-unused).

Also built: board drag and drop (dnd-kit; mouse, touch press-and-hold, keyboard
with screen-reader announcements), attachments on tasks and issues (files in
Cloudflare R2 to avoid Supabase egress, keyed `{org}/{project}/…`; the server
records the row under RLS, then hands out a 5-minute signed PUT and 60-second
signed GETs, so access is still decided by the `attachments` policies; images
shrunk to ≤1600px in the browser, 10 MB cap; orphaned files removed weekly by
`scripts/r2-cleanup.mjs`), milestones tab with
progress, labels settings and task label chips, task dependencies ("blocked by",
loops rejected by a trigger), custom roles editor, per-project role overrides
(guarded so nobody can grant more than they have).

Also built:
- **Dark mode**: System / Light / Dark in the account menu. The choice is kept in
  `localStorage` and applied by an inline script in the root layout before first paint
  (no flash); colours are CSS tokens in `globals.css`, overridden under
  `html[data-theme="dark"]`. Option colours are mixed with the surface via `tone()`.
- **Live updates**: see §7.
- **Email notifications**: every in-app notification is also emailed through Resend.
  A trigger on `notifications` sends it with `pg_net` (asynchronous, never blocks the
  change, failures ignored). Off until three Vault secrets exist (`resend_api_key`,
  `email_from`, `app_url`), set with `scripts/email-setup.mjs`. Each person can turn
  emails off in the account menu (`profiles.email_notifications`).
- **Browser tests** (`e2e/`, Playwright) and **CI** (`.github/workflows/ci.yml`): on every
  push and pull request, typecheck, lint, the database security tests and the browser
  tests run against the live project with throwaway users and organizations that are
  deleted afterwards. Runs are serialized and never cancelled midway, so cleanup always runs.

Deliberately not built yet:
- **Invitation emails**: invite links are shown to copy and send yourself. (Supabase's own
  sign-up and password-reset emails need custom SMTP before outside users sign up.)
- **Live deletes**: Realtime can't filter delete events, so a task deleted by someone else
  disappears on the next refresh or navigation rather than instantly.
- **Orphaned-file cleanup for hard-deleted projects/organizations**: deleting a task
  removes its files first, but a project or organization hard-deleted from SQL leaves
  its storage folder behind (the UI only archives). Remove `{org}/{project}/` from the
  bucket when doing that by hand.

## 9. Maintenance notes

- Migrations: `supabase/migrations`, applied with `npm run db:push`.
- DB types: `src/lib/database.types.ts`, generated from the Management API
  (`GET /v1/projects/{ref}/types/typescript?included_schemas=public`) because
  `supabase gen types --db-url` needs Docker.
- Advisors: `npx supabase db advisors --db-url "$SUPABASE_DB_URL"` — no security
  findings at the time of writing; "unused index" notes are expected until there is data.
- RLS lesson: a `STABLE` helper that reads the same table sees the statement's
  snapshot, so `INSERT … RETURNING` fails if the SELECT policy looks the new row up
  through that helper. Check the row's own columns instead (see `projects_select_fix`).
