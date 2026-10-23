# mso-pm

**Free, open-source project management for software studios and teams.**
Kanban boards, tasks, issues, releases, clients, docs and team chat, across any
number of organizations with one login, with private-by-default data.

[Live app](https://pm.mshinan.com) ·
[Architecture](docs/ARCHITECTURE.md) ·
[Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md) ·
License: [AGPL-3.0](LICENSE)

![mso-pm](https://pm.mshinan.com/og.png)

## Features

- **Projects and boards**: board and list views, your own statuses, priorities
  and labels, drag and drop (mouse, touch and keyboard), checklists, task
  dependencies, milestones and releases.
- **Issues**: severity, steps, links to tasks, sorted by what matters.
- **Team chat**: a General channel per organization, a channel per project,
  named groups and direct messages, all live.
- **Notifications**: corner pop-ups with a sound, and per-category email for
  assignments, reviews, deadlines (08:00 in each organization's time zone),
  comments and project changes. Reviews follow task status.
- **Organizations and roles**: one login, many organizations; owner, admin,
  project manager, developer and viewer roles, custom roles, per-project
  overrides, single-use email invitations.
- **Clients and docs**: client records with their projects; docs next to the work.
- **Accounts**: 6-digit email codes for sign-up and password reset, 30-day
  sessions, email preferences, delete account.
- **Admin console** for whoever runs the installation: usage numbers, users
  and organizations (metadata only), suspend and restore, audit log, email
  delivery log, and an inbox for feature requests and issue reports.
- **Installable** on Android, iPhone and desktop (PWA), light and dark themes,
  works on phones.

## How it's built

Next.js 16 (App Router, Server Components) · Supabase (Postgres, Auth,
Realtime, Vault, `pg_cron`, `pg_net`) · Tailwind CSS v4 · Cloudflare R2 for
files · Resend for email · Vercel for hosting.

Every table has row-level security, so the database itself decides who can
read or change what: the UI only hides what you can't do. The model, schema
and trade-offs are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and
`tests/rls.test.ts` checks them against a real database with real users.

## Run your own copy

Everything below fits in free tiers: Supabase (database and auth), Vercel
Hobby (hosting, personal and non-commercial use), Cloudflare R2 (10 GB of
files, free downloads) and Resend (3,000 emails a month).

### 1. Database

1. Create a project at [supabase.com](https://supabase.com).
2. `cp .env.example .env.local` and fill in the Supabase values (Project
   Settings → API keys and Database → connection string, session pooler).
3. Apply the schema and make yourself the platform admin:

   ```bash
   npm install
   npm run db:push
   node --env-file=.env.local scripts/platform-admin.mjs you@example.org
   ```

### 2. App

```bash
npm run dev    # http://localhost:3000
```

Sign up with the email you made admin, confirm it with the code, and create an
organization. In Supabase → Authentication → URL Configuration, add your app's
URLs to the redirect list (`http://localhost:3000/**` and your production URL).

### 3. Email (sign-up codes and notifications)

Supabase's built-in email only reaches members of your Supabase team, so add
your own sender before inviting anyone:

1. In [Resend](https://resend.com), verify your domain and create an API key.
2. Supabase → Authentication → Emails → SMTP: host `smtp.resend.com`, port
   `465`, user `resend`, the API key as password, and your sender address.
3. Store the same settings for notification emails (read from the environment,
   so the key never lands in your shell history):

   ```bash
   RESEND_API_KEY=re_... node --env-file=.env.local scripts/email-setup.mjs "mso-pm <noreply@yourdomain.com>" https://your-app.example
   ```

4. After deploying (step 5), switch the sign-up and reset emails to codes:
   `node --env-file=.env.local scripts/auth-emails.mjs` (needs
   `SUPABASE_ACCESS_TOKEN`).

### 4. Files (Cloudflare R2)

1. Create a bucket (for example `mso-pm-attachments`) and add a CORS rule that
   allows `GET` and `PUT` with header `content-type` from your app's origins.
2. Create an R2 API token with Object Read & Write on that bucket.
3. Put `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
   `R2_BUCKET` in `.env.local`.

Without R2, everything works except attachments, which say storage isn't set up.

### 5. Deploy (Vercel)

Import the repository in Vercel, set these environment variables, and set the
function region close to your database:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Everything |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Attachments (mark the keys Sensitive) |
| `NEXT_PUBLIC_SITE_URL` | Your public address, for SEO and link previews |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_PORTFOLIO_URL`, `NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_SOURCE_URL` | The contact details on your landing page |

The app never needs the Supabase secret key at runtime; only scripts and tests use it.

## Development

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript, ESLint |
| `npm test` | Unit tests and database security tests (throwaway users on the real project, cleaned up after) |
| `npm run test:e2e` | Browser tests (Playwright on port 3100). First time: `npx playwright install chromium` |
| `npm run db:push` | Apply new migrations |
| `npm run db:sql -- -e "select 1"` | Run SQL |
| `npm run seed:demo` | Demo organization (`-- --add you@email.com` makes you an owner of it) |
| `node --env-file=.env.local scripts/cleanup-tests.mjs` | Remove test data left by an interrupted run |
| `node --env-file=.env.local scripts/r2-cleanup.mjs --dry-run` | List R2 files no attachment references (the weekly workflow deletes them) |

### Changing the database

1. `npx supabase migration new <name>` and write the SQL.
2. Every new table: `organization_id`, RLS enabled, explicit `grant ... to
   authenticated` (new tables are not exposed automatically), and policies
   built from the `private.*` helpers.
3. `npm run db:push`, then `npx supabase db advisors --db-url "$SUPABASE_DB_URL"`.
4. Regenerate `src/lib/database.types.ts` (see ARCHITECTURE.md §9) and add
   tests to `tests/rls.test.ts`.

### Continuous integration

`.github/workflows/ci.yml` runs typecheck, lint, the database security tests
and the browser tests (against a production build) on every push and pull
request. Pull requests from forks don't get repository secrets, so they run
typecheck, lint and the unit tests only; a maintainer runs the rest.

## Contributing

Issues and pull requests are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md).
Found a security problem? Please report it privately: see [SECURITY.md](SECURITY.md).

## License

[GNU AGPL-3.0](LICENSE). You may use, change and self-host mso-pm. If you run a
modified version as a service for other people, you must make your changes
available to them under the same license.

## Author

Built by [Muhammed Shinan](https://mshinan.com) ·
[GitHub](https://github.com/m-shinan) · [mshinan2002@gmail.com](mailto:mshinan2002@gmail.com)
