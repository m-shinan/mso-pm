-- Super-admin console for platform admins (private.platform_admins).
-- Admins see accounts and organizations as metadata: names, counts, dates,
-- status. They do NOT get read access to any organization's content; that
-- stays behind organization membership like everything else.
-- Every function checks private.is_platform_admin() itself and records what
-- it changed in admin_audit_log.

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id uuid,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_at on public.admin_audit_log (created_at desc);
create index admin_audit_log_actor on public.admin_audit_log (actor_id);
alter table public.admin_audit_log enable row level security;
grant select on public.admin_audit_log to authenticated;
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using ((select private.is_platform_admin()));

create function private.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform admins can do that' using errcode = '42501';
  end if;
end $$;

create function private.admin_log(action text, target_type text, target_id uuid, target_label text, details jsonb default '{}')
returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, actor_email, action, target_type, target_id, target_label, details)
  select (select auth.uid()), (select email from auth.users where id = (select auth.uid())),
         action, target_type, target_id, left(target_label, 200), details
$$;

revoke all on function private.require_platform_admin(), private.admin_log(text, text, uuid, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
create function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'users_active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'users_new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from auth.users where banned_until > now()),
    'organizations', (select count(*) from public.organizations where archived_at is null),
    'organizations_archived', (select count(*) from public.organizations where archived_at is not null),
    'projects', (select count(*) from public.projects where archived_at is null),
    'tasks', (select count(*) from public.tasks),
    'tasks_new_7d', (select count(*) from public.tasks where created_at > now() - interval '7 days'),
    'messages_7d', (select count(*) from public.chat_messages where created_at > now() - interval '7 days'),
    'feedback_open', (select count(*) from public.feedback where status = 'open'),
    'emails_24h', (select count(*) from net._http_response where created > now() - interval '24 hours'),
    'emails_failed_24h', (select count(*) from net._http_response
                          where created > now() - interval '24 hours' and (status_code is null or status_code >= 400))
  );
end $$;

create function public.admin_list_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, email text, full_name text, created_at timestamptz, last_sign_in_at timestamptz,
  confirmed boolean, suspended boolean, organizations integer, platform_admin boolean, total bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at,
    u.email_confirmed_at is not null, coalesce(u.banned_until > now(), false),
    (select count(*)::integer from public.organization_members m where m.user_id = u.id and m.status = 'active'),
    exists (select 1 from private.platform_admins a where a.email = lower(u.email)),
    count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(p_search, '') = ''
     or u.email ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

create function public.admin_list_organizations(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, name text, slug text, created_at timestamptz, archived_at timestamptz,
  members integer, projects integer, tasks integer, owner_email text, last_activity_at timestamptz, total bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select o.id, o.name, o.slug, o.created_at, o.archived_at,
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id and m.status = 'active'),
    (select count(*)::integer from public.projects pr where pr.organization_id = o.id),
    (select count(*)::integer from public.tasks t where t.organization_id = o.id),
    (select pf.email from public.organization_members m
       join public.roles r on r.id = m.role_id and r.key = 'owner'
       join public.profiles pf on pf.id = m.user_id
     where m.organization_id = o.id and m.status = 'active' order by m.joined_at limit 1),
    (select max(a.created_at) from public.activity a where a.organization_id = o.id),
    count(*) over ()
  from public.organizations o
  where coalesce(p_search, '') = '' or o.name ilike '%' || p_search || '%' or o.slug ilike '%' || p_search || '%'
  order by o.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- Recent outgoing emails (pg_net responses): status only, never content.
create function public.admin_recent_emails(p_limit integer default 50)
returns table (id bigint, status_code integer, error text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return query
  select r.id, r.status_code, left(coalesce(r.error_msg, case when r.status_code >= 400 then r.content end), 300),
         r.created
  from net._http_response r
  order by r.created desc
  limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------
-- Suspend: blocks sign-in and token refresh, and ends every session now.
create function public.admin_set_user_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  addr text;
begin
  perform private.require_platform_admin();
  if p_user = (select auth.uid()) then
    raise exception 'You can''t suspend yourself' using errcode = '42501';
  end if;
  update auth.users set banned_until = case when p_suspended then 'infinity'::timestamptz else null end
  where id = p_user returning email into addr;
  if addr is null then
    raise exception 'No such user' using errcode = 'P0002';
  end if;
  if p_suspended then
    delete from auth.sessions where user_id = p_user;
  end if;
  perform private.admin_log(case when p_suspended then 'user_suspended' else 'user_restored' end, 'user', p_user, addr);
end $$;

-- Delete someone's account (same rules as deleting your own: an organization's
-- only owner can't be removed, so no organization is left without an owner).
create function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  addr text;
  sole_org text;
begin
  perform private.require_platform_admin();
  if p_user = (select auth.uid()) then
    raise exception 'Delete your own account from Account settings' using errcode = '42501';
  end if;
  select email into addr from auth.users where id = p_user;
  if addr is null then
    raise exception 'No such user' using errcode = 'P0002';
  end if;
  select o.name into sole_org
  from public.organization_members m
  join public.roles r on r.id = m.role_id and r.key = 'owner'
  join public.organizations o on o.id = m.organization_id
  where m.user_id = p_user and m.status = 'active'
    and not exists (select 1 from public.organization_members m2
                    where m2.organization_id = m.organization_id and m2.role_id = m.role_id
                      and m2.status = 'active' and m2.user_id <> p_user)
  limit 1;
  if sole_org is not null then
    raise exception 'They''re the only owner of %. Archive or hand over that organization first.', sole_org using errcode = '23514';
  end if;
  perform private.admin_log('user_deleted', 'user', p_user, addr);
  delete from auth.users where id = p_user;
end $$;

-- Archive / restore any organization (archived organizations are read-only and hidden from members' lists).
create function public.admin_set_organization_archived(p_org uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  label text;
begin
  perform private.require_platform_admin();
  update public.organizations set archived_at = case when p_archived then now() else null end
  where id = p_org returning name into label;
  if label is null then
    raise exception 'No such organization' using errcode = 'P0002';
  end if;
  perform private.admin_log(case when p_archived then 'organization_archived' else 'organization_restored' end,
    'organization', p_org, label);
end $$;

-- Grant or remove platform-admin access by email. The last admin can't be removed.
create function public.admin_set_platform_admin(p_email text, p_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  addr text := lower(btrim(p_email));
begin
  perform private.require_platform_admin();
  if p_admin then
    insert into private.platform_admins (email) values (addr) on conflict do nothing;
  else
    if (select count(*) from private.platform_admins) <= 1 then
      raise exception 'There must be at least one platform admin' using errcode = '23514';
    end if;
    delete from private.platform_admins where email = addr;
  end if;
  perform private.admin_log(case when p_admin then 'admin_granted' else 'admin_revoked' end, 'user', null, addr);
end $$;

revoke all on function public.admin_stats(), public.admin_list_users(text, integer, integer),
  public.admin_list_organizations(text, integer, integer), public.admin_recent_emails(integer),
  public.admin_set_user_suspended(uuid, boolean), public.admin_delete_user(uuid),
  public.admin_set_organization_archived(uuid, boolean), public.admin_set_platform_admin(text, boolean)
  from public, anon;
grant execute on function public.admin_stats(), public.admin_list_users(text, integer, integer),
  public.admin_list_organizations(text, integer, integer), public.admin_recent_emails(integer),
  public.admin_set_user_suspended(uuid, boolean), public.admin_delete_user(uuid),
  public.admin_set_organization_archived(uuid, boolean), public.admin_set_platform_admin(text, boolean)
  to authenticated;
