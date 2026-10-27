-- OAuth consent for MCP clients lives at /oauth, so organizations can't use
-- that as their URL name. Same list as RESERVED in src/proxy.ts.
alter table public.organizations drop constraint organizations_slug_not_reserved;
alter table public.organizations add constraint organizations_slug_not_reserved check (
  slug not in ('login', 'signup', 'reset-password', 'onboarding', 'invite', 'auth', 'account', 'api',
               'app', 'privacy', 'terms', 'feedback', 'verify', 'admin', 'icons', 'icon', 'apple-icon', 'offline',
               'oauth')
) not valid;
