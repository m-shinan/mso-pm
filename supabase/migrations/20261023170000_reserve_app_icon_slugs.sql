-- The installable-app icons live at /icons/… and /apple-icon, so organizations
-- can't use those as their URL name either. Same list as RESERVED in src/proxy.ts.
alter table public.organizations drop constraint organizations_slug_not_reserved;
alter table public.organizations add constraint organizations_slug_not_reserved check (
  slug not in ('login', 'signup', 'reset-password', 'onboarding', 'invite', 'auth', 'account', 'api',
               'app', 'privacy', 'terms', 'feedback', 'verify', 'admin', 'icons', 'apple-icon', 'offline')
) not valid;
