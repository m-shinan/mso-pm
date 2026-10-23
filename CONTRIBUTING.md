# Contributing to mso-pm

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an issue with the templates. For a bigger change,
  open an issue first so we can agree on the approach before you write code.
- **Security problems:** never in a public issue. See [SECURITY.md](SECURITY.md).

## Setting up

Follow "Run your own copy" in the [README](README.md) with your own free
Supabase project. You need Node 22 or newer (24 recommended). The database and
browser tests create throwaway users and organizations in that project and
delete them afterwards.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Match the code around you: Server Components by default, client components
   only where there is interaction, Tailwind classes using the design tokens in
   `src/app/globals.css`, and short comments that explain *why*.
4. **Database changes** go in a new migration (never edit one that has been
   released). Every table needs `organization_id`, RLS, explicit grants and
   policies built from the `private.*` helpers, plus tests in `tests/rls.test.ts`
   that try to break them.
5. Run the checks:

   ```bash
   npm run typecheck && npm run lint
   npm test           # unit + database security tests
   npm run test:e2e   # browser tests
   ```

6. Open the pull request with what changed, why, and how you tested it. CI on
   pull requests from forks runs typecheck, lint and the unit tests; a
   maintainer runs the database and browser tests before merging.

## Guidelines

- **Accessibility:** real buttons and links, labels on every input, keyboard
  support, enough contrast in both themes, 44px touch targets on phones.
- **Privacy:** organizations must never see each other's data. If a feature
  touches access rules, explain them in the pull request.
- **No secrets** in code, tests, issues or screenshots.

By contributing you agree that your contributions are licensed under the
[AGPL-3.0](LICENSE), like the rest of the project.
