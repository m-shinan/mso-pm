# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them
privately, either way:

- GitHub: the **Security** tab of this repository → **Report a vulnerability**, or
- email **mshinan2002@gmail.com** with the subject "mso-pm security".

Include what you found, how to reproduce it, and what an attacker could do with
it. You'll get a reply within a few days. Please give a reasonable time to fix
it before telling anyone else; you'll be credited in the fix unless you'd
rather not be.

## In scope

The code in this repository and the hosted app at https://pm.mshinan.com, in
particular anything that lets someone:

- read or change another organization's data,
- act with a role or permission they weren't given,
- take over another person's account, or
- read files, emails or secrets they shouldn't.

Test only against your own self-hosted copy or accounts you own. Don't run
automated scanners, spam or denial-of-service tests against the hosted app,
and don't access other people's data.

## How the app is protected

Access is enforced by row-level security in Postgres on every table; the
interface only hides what you can't do. Secrets stay on the server or in
Supabase Vault. Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
