# mso-pm

Project management for a software studio: projects, tasks, issues, releases,
clients and documents, across any number of organizations with one login.

Next.js 16 · Supabase (Postgres + Auth, RLS on every table) · Tailwind v4.
Architecture, schema and security model: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Design: https://claude.ai/artifact/Mmb594PjtmzfUSUxtsnMNA

## Setup

Requires Node 22+ (24 recommended).

```bash
npm install
cp .env.example .env.local   # fill in values from the Supabase dashboard
npm run db:push              # apply supabase/migrations to the database
npm run dev                  # http://localhost:3000
```

Sign up, confirm your email, then create an organization.

In Supabase → Authentication → URL configuration, the Site URL and redirect
list must include your app's URL (e.g. `http://localhost:3000/**` and your
Vercel domain) or confirmation and reset links won't come back to the app.
Supabase's built-in email only delivers to members of your Supabase team; add
custom SMTP before inviting outside users to sign up.

### Email notifications (optional)

Notifications (assigned to you, comments on your work, added to a project) can
also go out by email through [Resend](https://resend.com) (free tier: 3,000/month).

1. Create a Resend account, add and verify your sending domain, create an API key.
2. Store the settings in Supabase Vault (the key is read from the environment, not typed as an argument):

   ```bash
   RESEND_API_KEY=re_... node --env-file=.env.local scripts/email-setup.mjs "mso-pm <notify@yourdomain.com>" https://your-app.vercel.app
   ```

Nothing is sent until this is done. `scripts/email-setup.mjs --off` turns it off again.
Each person can switch emails off in the account menu.

### Feedback inbox

"Request a feature" and "Report an issue" (account menu) save to the `feedback`
table. Senders can't read it back; only platform admins can, at `/feedback`,
and each new item is emailed to them through the same Resend settings. Admins
are listed by email in `private.platform_admins` (seeded with the owner's address):

```bash
npm run db:sql -- -e "insert into private.platform_admins values ('someone@example.org')"
```

Each person can send 5 items an hour. Senders on `@example.com` (the test suites) are not emailed.

### Admin console

Platform admins (above) also get `/admin`: usage numbers, every account and
organization (metadata only, never their content), suspend / restore / delete
accounts, archive organizations, recent email deliveries, and an audit log of
every admin action.

### Chat and notifications

Each organization has a General channel, a channel per project (whoever can
read the project), named groups, and direct messages, all live over Realtime.
Notifications pop up in the corner with a chime (per-device switch in the
account menu) and are emailed per category (Account settings). Reviews follow
task status: a status whose name contains "review" asks owners, admins and
project managers to review; leaving it tells the assignee it was approved or
needs changes. Deadline reminders run hourly via `pg_cron` and fire at 08:00 in
each organization's timezone.

### Sign-in emails

Sign-up and password reset use 6-digit codes typed into the app. The Supabase
Auth templates (codes, plus "password changed" and "email changed" notices) are
set by `node --env-file=.env.local scripts/auth-emails.mjs`; deploy the app first,
since the emails no longer contain links.

### Demo data (development only)

```bash
npm run seed:demo                        # demo@example.com, password written to .env.local
npm run seed:demo -- --add you@email.com # also make your account an owner of the demo org
```

The seed deletes and recreates the `arclight-demo` organization each run.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript, ESLint |
| `npm test` | Unit tests + database security tests (real users against the real project, cleaned up after) |
| `npm run test:e2e` | Browser tests (Playwright; starts the dev server on port 3100). First time: `npx playwright install chromium` |
| `node --env-file=.env.local scripts/cleanup-tests.mjs` | Remove test data left behind by an interrupted run |
| `npm run db:push` | Apply new migrations |
| `npm run db:sql -- -e "select 1"` | Run SQL (dev) |
| `npm run seed:demo` | Demo organization |

## Changing the database

1. `npx supabase migration new <name>` and write the SQL.
2. Every new table: `organization_id`, RLS enabled, explicit `grant ... to authenticated`
   (new tables are not exposed to the API automatically), policies using the
   `private.*` helpers.
3. `npm run db:push`, then `npx supabase db advisors --db-url "$SUPABASE_DB_URL"`.
4. Regenerate types (Management API, see ARCHITECTURE.md §9) and add tests to `tests/rls.test.ts`.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:
typecheck, lint, database security tests, then the browser tests against a
production build. It needs three repository secrets (already set):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`. The tests use the live project with throwaway users and
organizations (`mso-t…`/`mso-e2e…@example.com`) that are deleted afterwards.

## Deploying to Vercel

Set the two `NEXT_PUBLIC_*` variables in the Vercel project (the secret key is
not needed by the app). Set the function region to `bom1` (Mumbai) to sit next
to the database, and add the Vercel URL to Supabase's redirect list.
