-- While an organization or project is being deleted, cascades update tasks and
-- issues (e.g. assignees set to null). Their activity triggers then ran for a
-- project that no longer exists and failed. Skip logging when the project is gone.

create or replace function private.task_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := private.item_key(new.project_id, new.number);
  href text;
  ch jsonb := '{}'::jsonb;
begin
  if label is null then
    return new; -- project is being deleted
  end if;
  href := '/' || private.org_slug(new.organization_id) || '/projects/' || lower(split_part(label, '-', 1)) || '?task=' || lower(label);

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

create or replace function private.issue_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := private.item_key(new.project_id, new.number);
  href text;
  ch jsonb := '{}'::jsonb;
begin
  if label is null then
    return new; -- project is being deleted
  end if;
  href := '/' || private.org_slug(new.organization_id) || '/issues?issue=' || lower(label);

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

-- Same guard for comments whose task/issue is going away with its project.
create or replace function private.comment_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text;
  assignee uuid;
  href text;
begin
  if new.task_id is not null then
    select private.item_key(t.project_id, t.number), t.assignee_id into label, assignee from public.tasks t where t.id = new.task_id;
    href := '/' || private.org_slug(new.organization_id) || '/projects/' || lower(split_part(label, '-', 1)) || '?task=' || lower(label);
  else
    select private.item_key(i.project_id, i.number), i.assignee_id into label, assignee from public.issues i where i.id = new.issue_id;
    href := '/' || private.org_slug(new.organization_id) || '/issues?issue=' || lower(label);
  end if;
  if label is null then
    return new;
  end if;
  perform private.log_activity(new.organization_id, new.project_id, 'commented', 'comment',
    coalesce(new.task_id, new.issue_id), label, jsonb_build_object('excerpt', left(new.body, 140)));
  perform private.notify(new.organization_id, assignee, 'comment', 'comment', coalesce(new.task_id, new.issue_id),
    'New comment on ' || label, href);
  return new;
end $$;
