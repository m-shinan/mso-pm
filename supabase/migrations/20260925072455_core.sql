-- ============================================================================
-- mso-pm · core: profiles, organizations, roles, members, invitations, options
--
-- Tenant rule: every organization-owned row carries organization_id, RLS is on
-- for every table, and tables are granted to `authenticated` explicitly (new
-- tables are not exposed to the Data API automatically).
-- Helper functions live in the unexposed `private` schema.
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;

-- Keep updated_at honest.
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (global to the account)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_path text check (char_length(avatar_path) <= 300),
  last_org_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- New auth user -> profile. full_name from signup metadata is display-only;
-- nothing reads user metadata for authorization.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$')
    check (slug not in ('login', 'signup', 'onboarding', 'invite', 'api', 'auth', 'reset-password', 'account')),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  logo_color text not null default '#1B1B1F' check (logo_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  week_start smallint not null default 1 check (week_start between 0 and 6),
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_created_by_idx on public.organizations (created_by);
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

alter table public.profiles
  add constraint profiles_last_org_fk foreign key (last_org_id) references public.organizations (id) on delete set null;
create index profiles_last_org_idx on public.profiles (last_org_id);

-- Roles are data: a named list of permission keys (see src/lib/permissions.ts).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, id)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null,
  status text not null default 'active' check (status in ('active', 'deactivated')),
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  foreign key (organization_id, role_id) references public.roles (organization_id, id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_role_idx on public.organization_members (organization_id, role_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id uuid not null,
  -- sha256 hex of the token; the token itself is only ever in the invite link.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, role_id) references public.roles (organization_id, id)
);
create unique index invitations_one_pending on public.invitations (organization_id, email) where status = 'pending';
create index invitations_role_idx on public.invitations (organization_id, role_id);
create index invitations_invited_by_idx on public.invitations (invited_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

-- ---------------------------------------------------------------------------
-- Configurable options (types, statuses, priorities, severities)
-- `category` gives a status its meaning independent of its name.
-- Other tables reference (organization_id, id, kind) so a row can only point
-- at its own organization's options of the right kind.
-- ---------------------------------------------------------------------------
create table public.options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in (
    'project_type', 'project_status', 'task_status', 'task_priority',
    'issue_status', 'issue_severity', 'release_status')),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#6E6E76' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  category text,
  rank smallint check (rank between 1 and 20),
  sort_order integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id, kind),
  check (
    (kind = 'task_status' and category in ('not_started', 'active', 'blocked', 'completed')) or
    (kind = 'issue_status' and category in ('open', 'active', 'resolved', 'closed')) or
    (kind = 'project_status' and category in ('planned', 'active', 'paused', 'completed')) or
    (kind = 'release_status' and category in ('planned', 'active', 'released')) or
    (kind in ('project_type', 'task_priority', 'issue_severity') and category is null)
  ),
  check (is_active or not is_default)
);
create unique index options_one_default on public.options (organization_id, kind) where is_default;
create unique index options_unique_name on public.options (organization_id, kind, lower(name));
create index options_org_kind_idx on public.options (organization_id, kind, sort_order);
create trigger options_touch before update on public.options
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer: they read membership without RLS,
-- and only ever answer for the calling user).
-- ---------------------------------------------------------------------------
create function private.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and o.archived_at is null
$$;

create function private.org_ids_with(perm text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id
  from public.organization_members m
  join public.roles r on r.id = m.role_id
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and o.archived_at is null
    and perm = any (r.permissions)
$$;

create function private.co_member_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.user_id
  from public.organization_members m
  where m.organization_id in (select private.my_org_ids())
$$;

create function private.is_org_owner(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.roles r on r.id = m.role_id
    where m.organization_id = org and m.user_id = (select auth.uid())
      and m.status = 'active' and r.key = 'owner'
  )
$$;

revoke all on all functions in schema private from public;
grant execute on function private.my_org_ids(), private.org_ids_with(text),
  private.co_member_ids(), private.is_org_owner(uuid) to authenticated;

-- An organization always keeps an owner, and only owners hand out or take away ownership.
create function private.guard_owner_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner_role uuid;
  org uuid := coalesce(new.organization_id, old.organization_id);
begin
  select id into owner_role from public.roles where organization_id = org and key = 'owner';
  -- Direct SQL / service role (no end user) is trusted.
  if (select auth.uid()) is not null then
    if (tg_op in ('UPDATE', 'DELETE') and old.role_id = owner_role and old.user_id <> (select auth.uid())
        and not private.is_org_owner(org))
       or (tg_op in ('INSERT', 'UPDATE') and new.role_id = owner_role and not private.is_org_owner(org)
           and not (tg_op = 'INSERT' and not exists (select 1 from public.organization_members where organization_id = org))) then
      raise exception 'Only an owner can change owner access' using errcode = '42501';
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role_id = owner_role and old.status = 'active'
     and (tg_op = 'DELETE' or new.role_id <> owner_role or new.status <> 'active')
     and not exists (
       select 1 from public.organization_members
       where organization_id = org and role_id = owner_role and status = 'active' and user_id <> old.user_id)
     and exists (select 1 from public.organizations where id = org) then
    raise exception 'An organization needs at least one owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger organization_members_guard_owner
  before insert or update or delete on public.organization_members
  for each row execute function private.guard_owner_role();

-- ---------------------------------------------------------------------------
-- Defaults for a new organization
-- ---------------------------------------------------------------------------
create function private.seed_org(org uuid, template text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  all_perms text[] := array[
    'projects.read_all', 'projects.create', 'projects.update', 'projects.delete',
    'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    'issues.create', 'issues.update', 'issues.delete',
    'releases.manage', 'clients.manage', 'docs.edit',
    'members.invite', 'members.manage', 'settings.manage'];
begin
  insert into public.roles (organization_id, key, name, permissions, is_system) values
    (org, 'owner', 'Owner', all_perms, true),
    (org, 'admin', 'Admin', all_perms, true),
    (org, 'project_manager', 'Project manager', array[
      'projects.read_all', 'projects.create', 'projects.update',
      'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
      'issues.create', 'issues.update', 'issues.delete',
      'releases.manage', 'clients.manage', 'docs.edit', 'members.invite'], true),
    (org, 'developer', 'Developer', array[
      'tasks.create', 'tasks.update', 'issues.create', 'issues.update', 'docs.edit'], true),
    (org, 'viewer', 'Viewer', array[]::text[], true);

  if template = 'agency' then
    insert into public.options (organization_id, kind, name, color, category, rank, sort_order, is_default) values
      (org, 'project_type', 'E-commerce', '#2B4596', null, null, 0, false),
      (org, 'project_type', 'ERP', '#1F6B47', null, null, 1, false),
      (org, 'project_type', 'Digital menu', '#8A4A12', null, null, 2, false),
      (org, 'project_type', 'LMS', '#5B3C8C', null, null, 3, false),
      (org, 'project_type', 'Website', '#45454C', null, null, 4, false),
      (org, 'project_type', 'Mobile app', '#45454C', null, null, 5, false),
      (org, 'project_type', 'Web app', '#45454C', null, null, 6, true),
      (org, 'project_type', 'Custom', '#45454C', null, null, 7, false),
      (org, 'task_status', 'Backlog', '#8A8A92', 'not_started', null, 0, false),
      (org, 'task_status', 'Todo', '#6E6E76', 'not_started', null, 1, true),
      (org, 'task_status', 'In progress', '#C27A06', 'active', null, 2, false),
      (org, 'task_status', 'Review', '#7654C9', 'active', null, 3, false),
      (org, 'task_status', 'Testing', '#0E8388', 'active', null, 4, false),
      (org, 'task_status', 'Blocked', '#CC3A21', 'blocked', null, 5, false),
      (org, 'task_status', 'Done', '#2F8F5B', 'completed', null, 6, false),
      (org, 'issue_status', 'Open', '#6E6E76', 'open', null, 0, true),
      (org, 'issue_status', 'In progress', '#C27A06', 'active', null, 1, false),
      (org, 'issue_status', 'Ready for testing', '#0E8388', 'active', null, 2, false),
      (org, 'issue_status', 'Resolved', '#2F8F5B', 'resolved', null, 3, false),
      (org, 'issue_status', 'Closed', '#8A8A92', 'closed', null, 4, false),
      (org, 'issue_status', 'Reopened', '#CC3A21', 'open', null, 5, false);
  else
    insert into public.options (organization_id, kind, name, color, category, rank, sort_order, is_default) values
      (org, 'project_type', 'Project', '#45454C', null, null, 0, true),
      (org, 'task_status', 'Todo', '#6E6E76', 'not_started', null, 0, true),
      (org, 'task_status', 'In progress', '#C27A06', 'active', null, 1, false),
      (org, 'task_status', 'Done', '#2F8F5B', 'completed', null, 2, false),
      (org, 'issue_status', 'Open', '#6E6E76', 'open', null, 0, true),
      (org, 'issue_status', 'In progress', '#C27A06', 'active', null, 1, false),
      (org, 'issue_status', 'Resolved', '#2F8F5B', 'resolved', null, 2, false);
  end if;

  -- Shared by both templates.
  insert into public.options (organization_id, kind, name, color, category, rank, sort_order, is_default) values
    (org, 'project_status', 'Planning', '#8A8A92', 'planned', null, 0, true),
    (org, 'project_status', 'In progress', '#C27A06', 'active', null, 1, false),
    (org, 'project_status', 'Client review', '#7654C9', 'active', null, 2, false),
    (org, 'project_status', 'On hold', '#B5B4AF', 'paused', null, 3, false),
    (org, 'project_status', 'Completed', '#2F8F5B', 'completed', null, 4, false),
    (org, 'task_priority', 'Low', '#45454C', null, 1, 0, false),
    (org, 'task_priority', 'Medium', '#45454C', null, 2, 1, true),
    (org, 'task_priority', 'High', '#45454C', null, 3, 2, false),
    (org, 'task_priority', 'Urgent', '#D9480F', null, 4, 3, false),
    (org, 'issue_severity', 'Low', '#6E6E76', null, 1, 0, false),
    (org, 'issue_severity', 'Medium', '#8A6D00', null, 2, 1, true),
    (org, 'issue_severity', 'High', '#C2560C', null, 3, 2, false),
    (org, 'issue_severity', 'Critical', '#CC3A21', null, 4, 3, false),
    (org, 'release_status', 'Planned', '#8A8A92', 'planned', null, 0, true),
    (org, 'release_status', 'In progress', '#C27A06', 'active', null, 1, false),
    (org, 'release_status', 'Released', '#2F8F5B', 'released', null, 2, false);
end $$;
revoke all on function private.seed_org(uuid, text) from public;

-- Create an organization, make the caller its owner, seed defaults. One transaction.
create function public.create_organization(
  p_name text,
  p_slug text,
  p_template text default 'agency',
  p_timezone text default 'UTC',
  p_week_start smallint default 1
) returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  org public.organizations;
  palette text[] := array['#1B1B1F', '#2F6B5E', '#7A6440', '#2B4596', '#8A4A12', '#5B3C8C'];
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_template not in ('agency', 'minimal') then
    raise exception 'Unknown template' using errcode = '22023';
  end if;
  if (select count(*) from public.organizations where created_by = uid) >= 20 then
    raise exception 'Organization limit reached' using errcode = '54000';
  end if;

  insert into public.organizations (slug, name, timezone, week_start, created_by, logo_color)
  values (lower(btrim(p_slug)), btrim(p_name), p_timezone, p_week_start, uid,
          palette[1 + abs(hashtext(lower(btrim(p_slug)))) % array_length(palette, 1)])
  returning * into org;

  perform private.seed_org(org.id, p_template);

  insert into public.organization_members (organization_id, user_id, role_id)
  select org.id, uid, r.id from public.roles r where r.organization_id = org.id and r.key = 'owner';

  update public.profiles set last_org_id = org.id where id = uid;
  return org;
end $$;
revoke all on function public.create_organization(text, text, text, text, smallint) from public, anon;
grant execute on function public.create_organization(text, text, text, text, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.options enable row level security;

revoke all on public.profiles, public.organizations, public.roles, public.organization_members,
  public.invitations, public.options from anon, authenticated;
grant all on public.profiles, public.organizations, public.roles, public.organization_members,
  public.invitations, public.options to service_role;

-- profiles: yourself and people you share an organization with.
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path, last_org_id) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.co_member_ids()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and (last_org_id is null or last_org_id in (select private.my_org_ids())));

-- organizations: members read; settings.manage edits a few columns. Created via RPC.
grant select on public.organizations to authenticated;
grant update (name, logo_color, timezone, week_start) on public.organizations to authenticated;
create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.my_org_ids()));
create policy organizations_update on public.organizations for update to authenticated
  using (id in (select private.org_ids_with('settings.manage')))
  with check (id in (select private.org_ids_with('settings.manage')));

-- roles: members read; settings.manage edits (never the owner role).
grant select, insert, update, delete on public.roles to authenticated;
create policy roles_select on public.roles for select to authenticated
  using (organization_id in (select private.my_org_ids()));
create policy roles_insert on public.roles for insert to authenticated
  with check (organization_id in (select private.org_ids_with('settings.manage')) and key <> 'owner' and not is_system);
create policy roles_update on public.roles for update to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')) and key <> 'owner')
  with check (organization_id in (select private.org_ids_with('settings.manage')) and key <> 'owner');
create policy roles_delete on public.roles for delete to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')) and not is_system);

-- members: members read; members.manage changes role/status or removes; anyone can leave.
grant select, delete on public.organization_members to authenticated;
grant update (role_id, status) on public.organization_members to authenticated;
create policy members_select on public.organization_members for select to authenticated
  using (organization_id in (select private.my_org_ids()));
create policy members_update on public.organization_members for update to authenticated
  using (organization_id in (select private.org_ids_with('members.manage')))
  with check (organization_id in (select private.org_ids_with('members.manage')));
create policy members_delete on public.organization_members for delete to authenticated
  using (organization_id in (select private.org_ids_with('members.manage')) or user_id = (select auth.uid()));

-- invitations: only people who can invite see or create them. Accepting is an RPC.
grant select, insert on public.invitations to authenticated;
grant update (status) on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (organization_id in (select private.org_ids_with('members.invite')));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    organization_id in (select private.org_ids_with('members.invite'))
    and invited_by = (select auth.uid())
    and status = 'pending'
    -- Can't invite someone into the owner role.
    and role_id not in (select id from public.roles where key = 'owner')
  );
create policy invitations_update on public.invitations for update to authenticated
  using (organization_id in (select private.org_ids_with('members.invite')) and status = 'pending')
  with check (status = 'revoked');

-- options: members read; settings.manage writes. Options in use can't be deleted (FKs).
grant select, insert, update, delete on public.options to authenticated;
create policy options_select on public.options for select to authenticated
  using (organization_id in (select private.my_org_ids()));
create policy options_insert on public.options for insert to authenticated
  with check (organization_id in (select private.org_ids_with('settings.manage')));
create policy options_update on public.options for update to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')))
  with check (organization_id in (select private.org_ids_with('settings.manage')));
create policy options_delete on public.options for delete to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')));
