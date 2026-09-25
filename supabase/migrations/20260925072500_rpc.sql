-- ============================================================================
-- mso-pm · RPCs. Read RPCs are SECURITY INVOKER, so RLS still decides what the
-- caller sees; they exist to aggregate in Postgres and return small payloads.
-- Only the invitation/org lifecycle RPCs are SECURITY DEFINER, and they check
-- the caller explicitly.
-- ============================================================================

-- The caller's organization-level permission keys (for UI hints only).
create function public.my_permissions(p_org uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.permissions
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org and m.user_id = (select auth.uid())
      and m.status = 'active' and o.archived_at is null
  ), '{}')
$$;

-- ---------------------------------------------------------------------------
-- Dashboard: counts and short lists in one round trip.
-- ---------------------------------------------------------------------------
create function public.dashboard_summary(p_org uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
with
  me as (select (select auth.uid()) as uid),
  today as (
    select (now() at time zone coalesce((select timezone from public.organizations where id = p_org), 'UTC'))::date as d),
  proj as (
    select p.id, p.key, p.name, p.due_date, p.status_id, p.type_id, p.updated_at, o.category as status_category
    from public.projects p join public.options o on o.id = p.status_id
    where p.organization_id = p_org and p.archived_at is null),
  st as (select id, category from public.options where organization_id = p_org and kind = 'task_status'),
  open_tasks as (
    select t.id, t.project_id, t.number, t.title, t.status_id, t.priority_id, t.assignee_id, t.due_date,
           st.category, proj.key as project_key, proj.name as project_name
    from public.tasks t
    join st on st.id = t.status_id
    join proj on proj.id = t.project_id
    where t.organization_id = p_org and st.category <> 'completed'),
  sev as (select id, rank from public.options where organization_id = p_org and kind = 'issue_severity'),
  open_issues as (
    select i.id, i.project_id, i.number, i.title, i.severity_id, i.assignee_id, i.created_at, sev.rank,
           proj.key as project_key, proj.name as project_name
    from public.issues i
    join public.options s on s.id = i.status_id
    join sev on sev.id = i.severity_id
    join proj on proj.id = i.project_id
    where i.organization_id = p_org and s.category in ('open', 'active')),
  top_rank as (select max(rank) as r from sev),
  progress as (
    select t.project_id, count(*)::int as total, count(*) filter (where st.category = 'completed')::int as done
    from public.tasks t join st on st.id = t.status_id
    where t.organization_id = p_org
    group by t.project_id),
  task_json as (
    select ot.*, jsonb_build_object(
      'id', ot.id, 'key', ot.project_key || '-' || ot.number, 'title', ot.title, 'statusId', ot.status_id,
      'priorityId', ot.priority_id, 'assigneeId', ot.assignee_id, 'dueDate', ot.due_date,
      'projectId', ot.project_id, 'projectName', ot.project_name) as j
    from open_tasks ot)
select jsonb_build_object(
  'stats', jsonb_build_object(
    'activeProjects', (select count(*) from proj where status_category = 'active'),
    'dueToday', (select count(*) from open_tasks, me, today where assignee_id = me.uid and due_date = today.d),
    'overdue', (select count(*) from open_tasks, today where due_date < today.d),
    'oldestOverdueDays', coalesce((select max(today.d - due_date) from open_tasks, today where due_date < today.d), 0),
    'openIssues', (select count(*) from open_issues),
    'criticalIssues', (select count(*) from open_issues, top_rank where rank = top_rank.r),
    'blocked', (select count(*) from open_tasks where category = 'blocked')),
  'attention', coalesce((
    select jsonb_agg(a.j order by a.sort1, a.sort2) from (
      select * from (
        select 0 as sort1, extract(epoch from now() - oi.created_at) as sort2, jsonb_build_object(
          'id', oi.id, 'kind', 'issue', 'title', oi.title, 'key', oi.project_key || '-' || oi.number,
          'project', oi.project_name, 'reason', 'Critical issue', 'tone', 'danger',
          'severityId', oi.severity_id, 'personId', oi.assignee_id) as j
        from open_issues oi, top_rank where oi.rank = top_rank.r
        union all
        select 1, ot.due_date - today.d, jsonb_build_object(
          'id', ot.id, 'kind', 'task', 'title', ot.title, 'key', ot.project_key || '-' || ot.number,
          'project', ot.project_name, 'reason', 'Overdue ' || (today.d - ot.due_date) || 'd', 'tone', 'warn',
          'statusId', ot.status_id, 'personId', ot.assignee_id)
        from open_tasks ot, today where ot.due_date < today.d and ot.category <> 'blocked'
        union all
        select 2, 0, jsonb_build_object(
          'id', ot.id, 'kind', 'task', 'title', ot.title, 'key', ot.project_key || '-' || ot.number,
          'project', ot.project_name, 'reason', 'Blocked', 'tone', 'danger',
          'statusId', ot.status_id, 'personId', ot.assignee_id)
        from open_tasks ot where ot.category = 'blocked'
        union all
        select 3, p.due_date - today.d, jsonb_build_object(
          'id', p.id, 'kind', 'project', 'title', p.name || ' deadline', 'key', p.key, 'project', p.name,
          'reason', 'Due in ' || (p.due_date - today.d) || ' days · ' ||
            coalesce(round(100.0 * pr.done / nullif(pr.total, 0)), 0) || '%',
          'tone', 'neutral', 'personId', null)
        from proj p cross join today left join progress pr on pr.project_id = p.id
        where p.status_category = 'active' and p.due_date between today.d and today.d + 14
      ) all_items
      order by sort1, sort2 limit 6
    ) a), '[]'::jsonb),
  'myWork', jsonb_build_object(
    'today', coalesce((select jsonb_agg(j order by due_date) from task_json, me, today
                       where assignee_id = me.uid and due_date <= today.d), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(j order by due_date nulls last) from (
                  select j, due_date from task_json, me, today
                  where assignee_id = me.uid and (due_date > today.d or due_date is null)
                  order by due_date nulls last limit 20) x), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(j) from task_json, me
                         where assignee_id = me.uid and category = 'blocked'), '[]'::jsonb)),
  'deadlines', coalesce((
    select jsonb_agg(d order by (d ->> 'date')) from (
      select jsonb_build_object('id', id, 'date', due_date, 'title', title, 'kind', kind) as d from (
        select p.id, p.due_date, p.name as title, 'Project deadline' as kind
        from proj p, today where p.due_date >= today.d and p.status_category <> 'completed'
        union all
        select r.id, r.release_date, p.name || ' ' || r.version, 'Release'
        from public.releases r join proj p on p.id = r.project_id join public.options o on o.id = r.status_id, today
        where r.organization_id = p_org and r.release_date >= today.d and o.category <> 'released'
        union all
        select m.id, m.due_date, p.name || ' · ' || m.name, 'Milestone'
        from public.milestones m join proj p on p.id = m.project_id, today
        where m.organization_id = p_org and m.due_date >= today.d
        order by 2 limit 4
      ) u
    ) x), '[]'::jsonb),
  'projects', coalesce((
    select jsonb_agg(j order by sort, name) from (
      select p.name, case p.status_category when 'active' then 0 else 1 end as sort, jsonb_build_object(
        'id', p.id, 'key', p.key, 'name', p.name, 'typeId', p.type_id, 'statusId', p.status_id,
        'dueDate', p.due_date, 'updatedAt', p.updated_at,
        'tasksDone', coalesce(pr.done, 0), 'tasksTotal', coalesce(pr.total, 0),
        'memberIds', coalesce((select jsonb_agg(pm.user_id) from public.project_members pm where pm.project_id = p.id), '[]'::jsonb)
      ) as j
      from proj p left join progress pr on pr.project_id = p.id
      where p.status_category in ('active', 'planned')
      order by sort, p.name limit 5
    ) x), '[]'::jsonb)
)
$$;

-- ---------------------------------------------------------------------------
-- Search: top 5 per type, trigram-indexed ILIKE, scoped to one org.
-- ---------------------------------------------------------------------------
create function public.search_org(p_org uuid, p_query text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  pat text;
begin
  if char_length(btrim(coalesce(p_query, ''))) < 2 then
    return '[]'::jsonb;
  end if;
  pat := '%' || replace(replace(replace(left(btrim(p_query), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((
    select jsonb_agg(h) from (
      (select jsonb_build_object('group', 'Projects', 'id', p.id, 'key', null, 'title', p.name,
              'meta', o.name, 'href', '/projects/' || lower(p.key)) as h
       from public.projects p join public.options o on o.id = p.type_id
       where p.organization_id = p_org and p.archived_at is null and (p.name ilike pat or p.key ilike pat)
       order by p.name limit 5)
      union all
      (select jsonb_build_object('group', 'Tasks', 'id', t.id, 'key', p.key || '-' || t.number, 'title', t.title,
              'meta', p.name || ' · ' || o.name, 'href', '/projects/' || lower(p.key))
       from public.tasks t join public.projects p on p.id = t.project_id join public.options o on o.id = t.status_id
       where t.organization_id = p_org and (t.title ilike pat or (p.key || '-' || t.number) ilike pat)
       order by t.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'Issues', 'id', i.id, 'key', p.key || '-' || i.number, 'title', i.title,
              'meta', o.name, 'href', '/issues?issue=' || lower(p.key) || '-' || i.number)
       from public.issues i join public.projects p on p.id = i.project_id join public.options o on o.id = i.severity_id
       where i.organization_id = p_org and (i.title ilike pat or (p.key || '-' || i.number) ilike pat)
       order by i.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'Clients', 'id', c.id, 'key', null, 'title', c.name,
              'meta', c.industry, 'href', '/clients?client=' || c.id)
       from public.clients c
       where c.organization_id = p_org and c.archived_at is null and (c.name ilike pat or c.contact_name ilike pat)
       order by c.name limit 5)
      union all
      (select jsonb_build_object('group', 'Documents', 'id', d.id, 'key', null, 'title', p.name || ' · ' || d.title,
              'meta', 'Document', 'href', '/docs?doc=' || d.id)
       from public.documents d join public.projects p on p.id = d.project_id
       where d.organization_id = p_org and d.title ilike pat
       order by d.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'People', 'id', pr.id, 'key', null, 'title', pr.full_name,
              'meta', r.name, 'href', '/team')
       from public.organization_members m
       join public.profiles pr on pr.id = m.user_id
       join public.roles r on r.id = m.role_id
       where m.organization_id = p_org and (pr.full_name ilike pat or pr.email ilike pat)
       order by pr.full_name limit 5)
    ) hits), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Calendar: dated items in a window (max ~3 months).
-- ---------------------------------------------------------------------------
create function public.calendar_items(p_org uuid, p_from date, p_to date)
returns table (id uuid, day date, kind text, label text, sub text, project_key text, status_id uuid, done boolean)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.due_date, 'task', p.key || '-' || t.number || ' ' || t.title, p.name, p.key, t.status_id,
         o.category = 'completed'
  from public.tasks t join public.projects p on p.id = t.project_id join public.options o on o.id = t.status_id
  where t.organization_id = p_org and t.due_date between p_from and p_to and p_to - p_from <= 100
  union all
  select p.id, p.due_date, 'deadline', p.name, 'Project deadline', p.key, null, false
  from public.projects p
  where p.organization_id = p_org and p.archived_at is null and p.due_date between p_from and p_to and p_to - p_from <= 100
  union all
  select m.id, m.due_date, 'milestone', p.key || ' · ' || m.name, 'Milestone', p.key, null, false
  from public.milestones m join public.projects p on p.id = m.project_id
  where m.organization_id = p_org and m.due_date between p_from and p_to and p_to - p_from <= 100
  union all
  select r.id, r.release_date, 'release', p.key || ' ' || r.version, 'Release', p.key, null, false
  from public.releases r join public.projects p on p.id = r.project_id
  where r.organization_id = p_org and r.release_date between p_from and p_to and p_to - p_from <= 100
  order by 2
$$;

-- How many records use each option (settings screen only).
create function public.option_usage(p_org uuid)
returns table (option_id uuid, uses bigint)
language sql stable security invoker set search_path = '' as $$
  select id, count(*) from (
    select type_id as id from public.projects where organization_id = p_org
    union all select status_id from public.projects where organization_id = p_org
    union all select priority_id from public.projects where organization_id = p_org
    union all select status_id from public.tasks where organization_id = p_org
    union all select priority_id from public.tasks where organization_id = p_org
    union all select status_id from public.issues where organization_id = p_org
    union all select severity_id from public.issues where organization_id = p_org
    union all select priority_id from public.issues where organization_id = p_org
    union all select status_id from public.releases where organization_id = p_org
  ) used
  group by id
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create function private.sha256_hex(t text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;

-- What the invite page shows before accepting. Returns nothing for a bad token.
create function public.invitation_preview(p_token text)
returns table (organization_name text, role_name text, email text, status text, expired boolean)
language sql stable security definer set search_path = '' as $$
  select o.name, r.name, i.email, i.status, i.expires_at < now()
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  join public.roles r on r.id = i.role_id
  where i.token_hash = private.sha256_hex(p_token) and (select auth.uid()) is not null
$$;

-- Accept: only for the signed-in user whose email the invitation was sent to.
create function public.accept_invitation(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  my_email text;
  inv public.invitations;
  org_slug text;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select lower(email) into my_email from auth.users where id = uid;
  select * into inv from public.invitations where token_hash = private.sha256_hex(p_token) for update;
  if not found or inv.status <> 'pending' or inv.expires_at < now() then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;
  if inv.email <> my_email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  if exists (select 1 from public.organizations where id = inv.organization_id and archived_at is not null) then
    raise exception 'This organization is archived' using errcode = 'P0002';
  end if;

  insert into public.organization_members (organization_id, user_id, role_id)
  values (inv.organization_id, uid, inv.role_id)
  on conflict (organization_id, user_id) do update set status = 'active';

  update public.invitations set status = 'accepted', accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set last_org_id = inv.organization_id where id = uid;
  select slug into org_slug from public.organizations where id = inv.organization_id;
  return org_slug;
end $$;

-- Owner-only archive / restore of a whole organization.
create function public.set_organization_archived(p_org uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.organization_members m join public.roles r on r.id = m.role_id
    where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.status = 'active' and r.key = 'owner'
  ) then
    raise exception 'Only an owner can archive this organization' using errcode = '42501';
  end if;
  update public.organizations set archived_at = case when p_archived then now() end where id = p_org;
end $$;

-- Organizations the caller owns that are archived (so they can be restored).
create function public.my_archived_organizations()
returns table (id uuid, name text, slug text, archived_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.slug, o.archived_at
  from public.organizations o
  join public.organization_members m on m.organization_id = o.id
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and r.key = 'owner' and o.archived_at is not null
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: authenticated only.
-- ---------------------------------------------------------------------------
revoke all on function public.my_permissions(uuid), public.dashboard_summary(uuid), public.search_org(uuid, text),
  public.calendar_items(uuid, date, date), public.option_usage(uuid), public.invitation_preview(text),
  public.accept_invitation(text), public.set_organization_archived(uuid, boolean),
  public.my_archived_organizations() from public, anon;
grant execute on function public.my_permissions(uuid), public.dashboard_summary(uuid), public.search_org(uuid, text),
  public.calendar_items(uuid, date, date), public.option_usage(uuid), public.invitation_preview(text),
  public.accept_invitation(text), public.set_organization_archived(uuid, boolean),
  public.my_archived_organizations() to authenticated;
revoke all on function private.sha256_hex(text) from public;
grant execute on function private.sha256_hex(text) to authenticated;
