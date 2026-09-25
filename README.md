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

## Deploying to Vercel

Set the two `NEXT_PUBLIC_*` variables in the Vercel project (the secret key is
not needed by the app). Set the function region to `bom1` (Mumbai) to sit next
to the database, and add the Vercel URL to Supabase's redirect list.
