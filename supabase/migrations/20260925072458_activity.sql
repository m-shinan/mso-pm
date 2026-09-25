-- ============================================================================
-- mso-pm · activity log + in-app notifications, written by triggers.
-- Clients can read (RLS) but never write these tables directly.
-- ============================================================================

create table public.activity (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 40),
  entity_type text not null check (entity_type in ('project', 'task', 'issue', 'release', 'member', 'comment')),
  entity_id uuid,
  -- Human label at the time of the event, e.g. "SKR-142" or "Souq Karam".
  entity_label text not null default '' check (char_length(entity_label) <= 120),
  -- {"status": ["In progress", "Review"], "due_date": ["2026-09-25", "2026-09-27"]}
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index activity_org_created_idx on public.activity (organization_id, created_at desc, id desc);
create index activity_project_created_idx on public.activity (project_id, created_at desc, id desc);
create index activity_actor_idx on public.activity (actor_id);

create table public.notifications (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('task_assigned', 'issue_assigned', 'comment', 'member_added')),
  entity_type text not null,
  entity_id uuid,
  title text not null check (char_length(title) <= 200),
  href text not null default '' check (char_length(href) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, organization_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_org_idx on public.notifications (organization_id);
create index notifications_actor_idx on public.notifications (actor_id);

alter table public.activity enable row level security;
alter table public.notifications enable row level security;
revoke all on public.activity, public.notifications from anon, authenticated;
grant all on public.activity, public.notifications to service_role;
grant select on public.activity to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy activity_select on public.activity for select to authenticated
  using (
    (project_id is null and organization_id in (select private.my_org_ids()))
    or project_id in (select private.readable_project_ids()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select private.my_org_ids()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Writers
-- ---------------------------------------------------------------------------
create function private.log_activity(
  org uuid, project uuid, action text, entity_type text, entity_id uuid, label text, changes jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.activity (organization_id, project_id, actor_id, action, entity_type, entity_id, entity_label, changes)
  values (org, project, (select auth.uid()), action, entity_type, entity_id, left(label, 120), changes)
$$;

create function private.notify(
  org uuid, recipient uuid, kind text, entity_type text, entity_id uuid, title text, href text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (organization_id, user_id, actor_id, kind, entity_type, entity_id, title, href)
  select org, recipient, (select auth.uid()), kind, entity_type, entity_id, left(title, 200), href
  -- Never notify people about their own actions.
  where recipient is not null and recipient is distinct from (select auth.uid())
$$;

create function private.option_name(id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select name from public.options where options.id = option_name.id
$$;

create function private.item_key(project uuid, num integer) returns text
language sql stable security definer set search_path = '' as $$
  select p.key || '-' || num from public.projects p where p.id = project
$$;

create function private.org_slug(org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select slug from public.organizations where id = org
$$;

-- Tasks
create function private.task_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := private.item_key(new.project_id, new.number);
  href text := '/' || private.org_slug(new.organization_id) || '/projects/' || lower(split_part(label, '-', 1));
  ch jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, new.project_id, 'created', 'task', new.id, label,
      jsonb_build_object('title', new.title));
    perform private.notify(new.organization_id, new.assignee_id, 'task_assigned', 'task', new.id,
      label || ' ' || new.title || ' was assigned to you', href);
    return new;
  end if;

  if new.status_id is distinct from old.status_id then
    ch := ch || jsonb_build_object('status', jsonb_build_array(private.option_name(old.status_id), private.option_name(new.status_id)));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    ch := ch || jsonb_build_object('assignee', jsonb_build_array(
      (select full_name from public.profiles where id = old.assignee_id),
      (select full_name from public.profiles where id = new.assignee_id)));
    perform private.notify(new.organization_id, new.assignee_id, 'task_assigned', 'task', new.id,
      label || ' ' || new.title || ' was assigned to you', href);
  end if;
  if new.due_date is distinct from old.due_date then
    ch := ch || jsonb_build_object('due_date', jsonb_build_array(old.due_date, new.due_date));
  end if;
  if new.priority_id is distinct from old.priority_id then
    ch := ch || jsonb_build_object('priority', jsonb_build_array(private.option_name(old.priority_id), private.option_name(new.priority_id)));
  end if;
  if new.title is distinct from old.title then
    ch := ch || jsonb_build_object('title', jsonb_build_array(old.title, new.title));
  end if;
  if ch <> '{}'::jsonb then
    perform private.log_activity(new.organization_id, new.project_id,
      case when new.completed_at is not null and old.completed_at is null then 'completed' else 'updated' end,
      'task', new.id, label, ch);
  end if;
  return new;
end $$;
create trigger tasks_activity after insert or update on public.tasks
  for each row execute function private.task_activity();

create function private.task_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Skip when the whole project is being removed.
  if exists (select 1 from public.projects where id = old.project_id) then
    perform private.log_activity(old.organization_id, old.project_id, 'deleted', 'task', null,
      private.item_key(old.project_id, old.number), jsonb_build_object('title', old.title));
  end if;
  return old;
end $$;
create trigger tasks_deleted after delete on public.tasks
  for each row execute function private.task_deleted();

-- Issues
create function private.issue_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := private.item_key(new.project_id, new.number);
  href text := '/' || private.org_slug(new.organization_id) || '/issues?issue=' || lower(label);
  ch jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, new.project_id, 'reported', 'issue', new.id, label,
      jsonb_build_object('title', new.title, 'severity', private.option_name(new.severity_id)));
    perform private.notify(new.organization_id, new.assignee_id, 'issue_assigned', 'issue', new.id,
      label || ' ' || new.title || ' was assigned to you', href);
    return new;
  end if;
  if new.status_id is distinct from old.status_id then
    ch := ch || jsonb_build_object('status', jsonb_build_array(private.option_name(old.status_id), private.option_name(new.status_id)));
  end if;
  if new.severity_id is distinct from old.severity_id then
    ch := ch || jsonb_build_object('severity', jsonb_build_array(private.option_name(old.severity_id), private.option_name(new.severity_id)));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    ch := ch || jsonb_build_object('assignee', jsonb_build_array(
      (select full_name from public.profiles where id = old.assignee_id),
      (select full_name from public.profiles where id = new.assignee_id)));
    perform private.notify(new.organization_id, new.assignee_id, 'issue_assigned', 'issue', new.id,
      label || ' ' || new.title || ' was assigned to you', href);
  end if;
  if ch <> '{}'::jsonb then
    perform private.log_activity(new.organization_id, new.project_id,
      case when new.resolved_at is not null and old.resolved_at is null then 'resolved'
           when new.resolved_at is null and old.resolved_at is not null then 'reopened'
           else 'updated' end,
      'issue', new.id, label, ch);
  end if;
  return new;
end $$;
create trigger issues_activity after insert or update on public.issues
  for each row execute function private.issue_activity();

-- Projects
create function private.project_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ch jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, new.id, 'created', 'project', new.id, new.name);
    return new;
  end if;
  if new.due_date is distinct from old.due_date then
    ch := ch || jsonb_build_object('due_date', jsonb_build_array(old.due_date, new.due_date));
  end if;
  if new.status_id is distinct from old.status_id then
    ch := ch || jsonb_build_object('status', jsonb_build_array(private.option_name(old.status_id), private.option_name(new.status_id)));
  end if;
  if new.name is distinct from old.name then
    ch := ch || jsonb_build_object('name', jsonb_build_array(old.name, new.name));
  end if;
  if new.archived_at is distinct from old.archived_at then
    perform private.log_activity(new.organization_id, new.id,
      case when new.archived_at is null then 'restored' else 'archived' end, 'project', new.id, new.name);
  end if;
  if ch <> '{}'::jsonb then
    perform private.log_activity(new.organization_id, new.id, 'updated', 'project', new.id, new.name, ch);
  end if;
  return new;
end $$;
create trigger projects_activity after insert or update on public.projects
  for each row execute function private.project_activity();

-- Project membership
create function private.project_member_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.project_members;
  who text;
  pname text;
begin
  if tg_op = 'INSERT' then m := new; else m := old; end if;
  who := (select full_name from public.profiles where id = m.user_id);
  pname := (select name from public.projects where id = m.project_id);
  if pname is null then return m; end if; -- project being deleted
  perform private.log_activity(m.organization_id, m.project_id,
    case when tg_op = 'INSERT' then 'member_added' else 'member_removed' end,
    'member', m.user_id, coalesce(who, 'Someone'), jsonb_build_object('project', pname));
  if tg_op = 'INSERT' then
    perform private.notify(m.organization_id, m.user_id, 'member_added', 'project', m.project_id,
      'You were added to ' || pname,
      '/' || private.org_slug(m.organization_id) || '/projects/' || lower((select key from public.projects where id = m.project_id)));
  end if;
  return m;
end $$;
create trigger project_members_activity after insert or delete on public.project_members
  for each row execute function private.project_member_activity();

-- Releases
create function private.release_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare label text := (select key from public.projects where id = new.project_id) || ' ' || new.version;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, new.project_id, 'created', 'release', new.id, label);
  elsif new.released_at is not null and old.released_at is null then
    perform private.log_activity(new.organization_id, new.project_id, 'released', 'release', new.id, label);
  end if;
  return new;
end $$;
create trigger releases_activity after insert or update on public.releases
  for each row execute function private.release_activity();

-- Comments: log, and tell the assignee.
create function private.comment_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text;
  assignee uuid;
  href text;
begin
  if new.task_id is not null then
    select private.item_key(t.project_id, t.number), t.assignee_id into label, assignee from public.tasks t where t.id = new.task_id;
    href := '/' || private.org_slug(new.organization_id) || '/projects/' || lower(split_part(label, '-', 1));
  else
    select private.item_key(i.project_id, i.number), i.assignee_id into label, assignee from public.issues i where i.id = new.issue_id;
    href := '/' || private.org_slug(new.organization_id) || '/issues?issue=' || lower(label);
  end if;
  perform private.log_activity(new.organization_id, new.project_id, 'commented', 'comment',
    coalesce(new.task_id, new.issue_id), label, jsonb_build_object('excerpt', left(new.body, 140)));
  perform private.notify(new.organization_id, assignee, 'comment', 'comment', coalesce(new.task_id, new.issue_id),
    'New comment on ' || label, href);
  return new;
end $$;
create trigger comments_activity after insert on public.comments
  for each row execute function private.comment_activity();

revoke all on all functions in schema private from public;
grant execute on function private.my_org_ids(), private.org_ids_with(text), private.co_member_ids(),
  private.is_org_owner(uuid), private.readable_project_ids(), private.project_ids_with(text) to authenticated;
