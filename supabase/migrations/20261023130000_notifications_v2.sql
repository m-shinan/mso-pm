-- Notifications v2: reviews, deadlines, project status, accepted invitations,
-- chat; per-category email switches. Each in-app notification still becomes
-- at most one email, and the client shows new ones as they arrive (Realtime).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'task_assigned', 'issue_assigned', 'comment', 'member_added',
  'review_requested', 'review_approved', 'changes_requested',
  'due_soon', 'overdue', 'invite_accepted', 'project_status', 'chat_message'
));

-- ---------------------------------------------------------------------------
-- Email preferences. email_notifications stays the master switch.
-- Account and security emails ignore these: they always go out.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column email_assignments boolean not null default true,
  add column email_reviews boolean not null default true,
  add column email_deadlines boolean not null default true,
  add column email_comments boolean not null default true,
  add column email_projects boolean not null default true,
  add column email_chat boolean not null default false;
grant update (email_assignments, email_reviews, email_deadlines, email_comments, email_projects, email_chat)
  on public.profiles to authenticated;

create function private.email_category_on(p public.profiles, kind text) returns boolean
language sql immutable set search_path = '' as $$
  select p.email_notifications and case
    when kind in ('task_assigned', 'issue_assigned') then p.email_assignments
    when kind in ('review_requested', 'review_approved', 'changes_requested') then p.email_reviews
    when kind in ('due_soon', 'overdue') then p.email_deadlines
    when kind = 'comment' then p.email_comments
    when kind in ('member_added', 'project_status', 'invite_accepted') then p.email_projects
    when kind = 'chat_message' then p.email_chat
    else false
  end
$$;

-- Every notification -> one email, if that category is on. At most one per
-- person, item and kind every 10 minutes, so toggling an assignee or posting
-- in a loop can't flood an inbox. Replaces the version from email_notifications.
create or replace function private.email_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  org_name text;
  link text;
begin
  select * into p from public.profiles where id = new.user_id;
  if p.id is null or new.actor_id is not distinct from new.user_id or not private.email_category_on(p, new.kind) then
    return new;
  end if;
  if exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id and n.kind = new.kind and n.entity_id is not distinct from new.entity_id
      and n.id <> new.id and n.created_at > now() - interval '10 minutes'
  ) then
    return new;
  end if;

  select o.name into org_name from public.organizations o where o.id = new.organization_id;
  link := private.app_url() || coalesce(nullif(new.href, ''), '/app');
  perform private.send_email(
    array[p.email],
    new.title,
    new.title || E'\n\nOpen: ' || link || E'\n\n' || coalesce(org_name, 'mso-pm')
      || E' · Choose which emails you get in Account settings.',
    private.email_html(new.title, coalesce(org_name, ''), 'Open in mso-pm', link,
      coalesce(org_name, 'mso-pm') || ' · Choose which emails you get in Account settings.'));
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Reviews follow the task's status. A status with "review" in its name is a
-- review step:
--   into review           -> owners, admins and project managers: review requested
--   review -> completed   -> assignee: approved
--   review -> anything else (not review) -> assignee: changes requested
-- ---------------------------------------------------------------------------
create function private.is_review_status(status uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select o.name ilike '%review%' from public.options o where o.id = status), false)
$$;

create function private.task_href(task public.tasks) returns text
language sql stable security definer set search_path = '' as $$
  select '/' || private.org_slug(task.organization_id) || '/projects/' || lower(p.key)
    || '?task=' || lower(p.key) || '-' || task.number
  from public.projects p where p.id = task.project_id
$$;

create function private.task_review_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was_review boolean := private.is_review_status(old.status_id);
  now_review boolean := private.is_review_status(new.status_id);
  label text := private.item_key(new.project_id, new.number) || ' ' || new.title;
  href text := private.task_href(new);
  reviewer uuid;
begin
  if now_review and not was_review then
    for reviewer in
      select m.user_id from public.organization_members m join public.roles r on r.id = m.role_id
      where m.organization_id = new.organization_id and m.status = 'active'
        and r.key in ('owner', 'admin', 'project_manager')
    loop
      perform private.notify(new.organization_id, reviewer, 'review_requested', 'task', new.id,
        label || ' is ready for review', href);
    end loop;
  elsif was_review and not now_review then
    if (select category from public.options where id = new.status_id) = 'completed' then
      perform private.notify(new.organization_id, new.assignee_id, 'review_approved', 'task', new.id,
        label || ' was approved', href);
    else
      perform private.notify(new.organization_id, new.assignee_id, 'changes_requested', 'task', new.id,
        'Changes requested on ' || label, href);
    end if;
  end if;
  return new;
end $$;
create trigger tasks_review_notify after update of status_id on public.tasks
  for each row when (old.status_id is distinct from new.status_id)
  execute function private.task_review_notify();

-- Project status changes -> everyone on the project.
create function private.project_status_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  member uuid;
  href text := '/' || private.org_slug(new.organization_id) || '/projects/' || lower(new.key);
  title text := new.name || ' is now ' || coalesce(private.option_name(new.status_id), 'updated');
begin
  for member in select user_id from public.project_members where project_id = new.id loop
    perform private.notify(new.organization_id, member, 'project_status', 'project', new.id, title, href);
  end loop;
  return new;
end $$;
create trigger projects_status_notify after update of status_id on public.projects
  for each row when (old.status_id is distinct from new.status_id)
  execute function private.project_status_notify();

-- ---------------------------------------------------------------------------
-- Deadlines. Every hour, organizations where it is now 08:00 local time get
-- reminders: tasks due tomorrow, and tasks that became overdue yesterday.
-- Only open tasks with an assignee, in active projects; never twice a day.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

create function private.send_deadline_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  org record;
begin
  for org in select id, slug, timezone from public.organizations where archived_at is null loop
    begin
      if extract(hour from now() at time zone org.timezone) <> 8 then
        continue;
      end if;
      insert into public.notifications (organization_id, user_id, actor_id, kind, entity_type, entity_id, title, href)
      select t.organization_id, t.assignee_id, null,
        case when t.due_date > d.today then 'due_soon' else 'overdue' end,
        'task', t.id,
        left(p.key || '-' || t.number || ' ' || t.title
          || case when t.due_date > d.today then ' is due tomorrow' else ' is overdue' end, 200),
        '/' || org.slug || '/projects/' || lower(p.key) || '?task=' || lower(p.key) || '-' || t.number
      from public.tasks t
      join public.projects p on p.id = t.project_id and p.archived_at is null
      join public.options s on s.id = t.status_id
      cross join (select (now() at time zone org.timezone)::date as today) d
      where t.organization_id = org.id and t.assignee_id is not null and s.category <> 'completed'
        and (t.due_date = d.today + 1 or t.due_date = d.today - 1)
        and not exists (
          select 1 from public.notifications n
          where n.entity_id = t.id and n.kind in ('due_soon', 'overdue') and n.created_at > now() - interval '20 hours');
    exception when others then
      -- A bad timezone in one organization must not stop the others.
      raise warning 'deadline reminders for %: %', org.id, sqlerrm;
    end;
  end loop;
end $$;
revoke all on function private.send_deadline_reminders() from public;

select cron.schedule('deadline-reminders', '0 * * * *', 'select private.send_deadline_reminders()');

revoke all on function private.email_category_on(public.profiles, text), private.is_review_status(uuid),
  private.task_href(public.tasks), private.task_review_notify(), private.project_status_notify() from public;
