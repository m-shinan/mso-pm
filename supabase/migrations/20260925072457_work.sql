-- ============================================================================
-- mso-pm · work: clients, labels, projects, members, milestones, releases,
-- tasks (+ labels, dependencies, checklist), issues, comments, attachments,
-- documents, pins.
--
-- Composite foreign keys keep every child in its parent's organization:
-- (organization_id, project_id) -> projects(organization_id, id), and
-- option references use (organization_id, <id>, <kind>) -> options.
-- ============================================================================

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  industry text not null default '' check (char_length(industry) <= 60),
  contact_name text not null default '' check (char_length(contact_name) <= 120),
  contact_role text not null default '' check (char_length(contact_role) <= 60),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  notes text not null default '' check (char_length(notes) <= 5000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index clients_org_idx on public.clients (organization_id, name);
create trigger clients_touch before update on public.clients for each row execute function private.touch_updated_at();

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null default '#6E6E76' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index labels_unique_name on public.labels (organization_id, lower(name));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  client_id uuid,
  type_id uuid not null,
  status_id uuid not null,
  priority_id uuid not null,
  type_kind text generated always as ('project_type') stored,
  status_kind text generated always as ('project_status') stored,
  priority_kind text generated always as ('task_priority') stored,
  start_date date,
  due_date date,
  completed_at timestamptz,
  repo_url text check (repo_url ~ '^https?://' and char_length(repo_url) <= 300),
  prod_url text check (prod_url ~ '^https?://' and char_length(prod_url) <= 300),
  staging_url text check (staging_url ~ '^https?://' and char_length(staging_url) <= 300),
  next_number integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, id),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (organization_id, client_id) references public.clients (organization_id, id),
  foreign key (organization_id, type_id, type_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, status_id, status_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, priority_id, priority_kind) references public.options (organization_id, id, kind)
);
create index projects_client_idx on public.projects (organization_id, client_id);
create index projects_type_idx on public.projects (organization_id, type_id);
create index projects_status_idx on public.projects (organization_id, status_id);
create index projects_priority_idx on public.projects (organization_id, priority_id);
create index projects_created_by_idx on public.projects (created_by);
create index projects_name_trgm on public.projects using gin (name extensions.gin_trgm_ops);
create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();

create table public.project_members (
  project_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  -- Null = use the member's organization role. Set = override for this project.
  role_id uuid,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, user_id) references public.organization_members (organization_id, user_id) on delete cascade,
  foreign key (organization_id, role_id) references public.roles (organization_id, id)
);
create index project_members_user_idx on public.project_members (user_id, organization_id);
create index project_members_org_user_idx on public.project_members (organization_id, user_id);
create index project_members_role_idx on public.project_members (organization_id, role_id);

create table public.project_pins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null,
  organization_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index project_pins_project_idx on public.project_pins (organization_id, project_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index milestones_org_project_idx on public.milestones (organization_id, project_id);
create index milestones_due_idx on public.milestones (organization_id, due_date);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  version text not null check (version ~ '^v?\d+(\.\d+){0,2}([-+][0-9A-Za-z.]+)?$'),
  name text not null default '' check (char_length(name) <= 80),
  notes text not null default '' check (char_length(notes) <= 5000),
  status_id uuid not null,
  status_kind text generated always as ('release_status') stored,
  release_date date,
  released_at timestamptz,
  changelog jsonb not null default '{"added": [], "changed": [], "fixed": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version),
  unique (project_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, status_id, status_kind) references public.options (organization_id, id, kind)
);
create index releases_org_project_idx on public.releases (organization_id, project_id);
create index releases_status_idx on public.releases (organization_id, status_id);
create index releases_date_idx on public.releases (organization_id, release_date);
create trigger releases_touch before update on public.releases for each row execute function private.touch_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  number integer not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  status_id uuid not null,
  priority_id uuid not null,
  status_kind text generated always as ('task_status') stored,
  priority_kind text generated always as ('task_priority') stored,
  assignee_id uuid,
  reporter_id uuid references public.profiles (id) on delete set null,
  milestone_id uuid,
  release_id uuid,
  parent_id uuid,
  start_date date,
  due_date date,
  estimate_minutes integer check (estimate_minutes between 0 and 100000),
  actual_minutes integer check (actual_minutes between 0 and 100000),
  sort_order double precision not null default 0,
  blocked_reason text check (char_length(blocked_reason) <= 300),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  unique (project_id, id),
  check (parent_id is null or parent_id <> id),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, status_id, status_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, priority_id, priority_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, assignee_id) references public.organization_members (organization_id, user_id) on delete set null (assignee_id),
  foreign key (project_id, milestone_id) references public.milestones (project_id, id) on delete set null (milestone_id),
  foreign key (project_id, release_id) references public.releases (project_id, id) on delete set null (release_id),
  foreign key (project_id, parent_id) references public.tasks (project_id, id) on delete cascade
);
create index tasks_org_idx on public.tasks (organization_id);
create index tasks_project_status_idx on public.tasks (project_id, status_id, sort_order);
create index tasks_assignee_due_idx on public.tasks (organization_id, assignee_id, due_date);
create index tasks_due_idx on public.tasks (organization_id, due_date) where due_date is not null;
create index tasks_status_idx on public.tasks (organization_id, status_id);
create index tasks_priority_idx on public.tasks (organization_id, priority_id);
create index tasks_reporter_idx on public.tasks (reporter_id);
create index tasks_milestone_idx on public.tasks (project_id, milestone_id);
create index tasks_release_idx on public.tasks (project_id, release_id);
create index tasks_parent_idx on public.tasks (project_id, parent_id);
create index tasks_title_trgm on public.tasks using gin (title extensions.gin_trgm_ops);
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();

create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  project_id uuid not null,
  organization_id uuid not null,
  primary key (task_id, label_id),
  foreign key (project_id, task_id) references public.tasks (project_id, id) on delete cascade,
  foreign key (organization_id, label_id) references public.labels (organization_id, id) on delete cascade
);
create index task_labels_label_idx on public.task_labels (organization_id, label_id);
create index task_labels_project_idx on public.task_labels (project_id, task_id);

create table public.task_dependencies (
  task_id uuid not null,
  blocked_by_id uuid not null,
  project_id uuid not null,
  organization_id uuid not null,
  primary key (task_id, blocked_by_id),
  check (task_id <> blocked_by_id),
  foreign key (project_id, task_id) references public.tasks (project_id, id) on delete cascade,
  foreign key (project_id, blocked_by_id) references public.tasks (project_id, id) on delete cascade
);
create index task_dependencies_blocked_by_idx on public.task_dependencies (project_id, blocked_by_id);
create index task_dependencies_task_idx on public.task_dependencies (project_id, task_id);
create index task_dependencies_org_idx on public.task_dependencies (organization_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  done boolean not null default false,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  foreign key (project_id, task_id) references public.tasks (project_id, id) on delete cascade
);
create index checklist_items_task_idx on public.checklist_items (project_id, task_id, sort_order);
create index checklist_items_org_idx on public.checklist_items (organization_id);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  -- Shares the project's counter with tasks, so SKR-88 is unique across both.
  number integer not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 20000),
  status_id uuid not null,
  severity_id uuid not null,
  priority_id uuid not null,
  status_kind text generated always as ('issue_status') stored,
  severity_kind text generated always as ('issue_severity') stored,
  priority_kind text generated always as ('task_priority') stored,
  assignee_id uuid,
  reporter_id uuid references public.profiles (id) on delete set null,
  environment text not null default '' check (char_length(environment) <= 120),
  steps text[] not null default '{}' check (cardinality(steps) <= 50),
  expected text not null default '' check (char_length(expected) <= 2000),
  actual text not null default '' check (char_length(actual) <= 2000),
  related_task_id uuid,
  release_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  unique (project_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (organization_id, status_id, status_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, severity_id, severity_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, priority_id, priority_kind) references public.options (organization_id, id, kind),
  foreign key (organization_id, assignee_id) references public.organization_members (organization_id, user_id) on delete set null (assignee_id),
  foreign key (project_id, related_task_id) references public.tasks (project_id, id) on delete set null (related_task_id),
  foreign key (project_id, release_id) references public.releases (project_id, id) on delete set null (release_id)
);
create index issues_org_status_idx on public.issues (organization_id, status_id);
create index issues_org_severity_idx on public.issues (organization_id, severity_id);
create index issues_org_priority_idx on public.issues (organization_id, priority_id);
create index issues_project_idx on public.issues (project_id, created_at desc);
create index issues_assignee_idx on public.issues (organization_id, assignee_id);
create index issues_reporter_idx on public.issues (reporter_id);
create index issues_related_task_idx on public.issues (project_id, related_task_id);
create index issues_release_idx on public.issues (project_id, release_id);
create index issues_title_trgm on public.issues using gin (title extensions.gin_trgm_ops);
create trigger issues_touch before update on public.issues for each row execute function private.touch_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  issue_id uuid,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(task_id, issue_id) = 1),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (project_id, task_id) references public.tasks (project_id, id) on delete cascade,
  foreign key (project_id, issue_id) references public.issues (project_id, id) on delete cascade
);
create index comments_task_idx on public.comments (project_id, task_id, created_at desc);
create index comments_issue_idx on public.comments (project_id, issue_id, created_at desc);
create index comments_org_idx on public.comments (organization_id, project_id);
create index comments_author_idx on public.comments (author_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  issue_id uuid,
  -- {organization_id}/{project_id}/{task|issue}/{id}/{file} in a private bucket.
  storage_path text not null unique check (char_length(storage_path) <= 400),
  name text not null check (char_length(name) between 1 and 200),
  size_bytes bigint not null check (size_bytes between 0 and 10485760),
  mime_type text not null check (char_length(mime_type) <= 100),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(task_id, issue_id) = 1),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  foreign key (project_id, task_id) references public.tasks (project_id, id) on delete cascade,
  foreign key (project_id, issue_id) references public.issues (project_id, id) on delete cascade
);
create index attachments_task_idx on public.attachments (project_id, task_id);
create index attachments_issue_idx on public.attachments (project_id, issue_id);
create index attachments_org_idx on public.attachments (organization_id, project_id);
create index attachments_uploader_idx on public.attachments (uploaded_by);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 100000),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade
);
create index documents_org_project_idx on public.documents (organization_id, project_id, updated_at desc);
create index documents_project_idx on public.documents (project_id);
create index documents_updated_by_idx on public.documents (updated_by);
create index documents_title_trgm on public.documents using gin (title extensions.gin_trgm_ops);
create trigger documents_touch before update on public.documents for each row execute function private.touch_updated_at();

create index clients_name_trgm on public.clients using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Numbering and derived columns
-- ---------------------------------------------------------------------------
-- Next SKR-### number. Row lock on the project serializes concurrent inserts.
create function private.assign_item_number() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.projects set next_number = next_number + 1
  where id = new.project_id and organization_id = new.organization_id
  returning next_number - 1 into new.number;
  if new.number is null then
    raise exception 'Project not found' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger tasks_number before insert on public.tasks for each row execute function private.assign_item_number();
create trigger issues_number before insert on public.issues for each row execute function private.assign_item_number();

-- Numbers never change after insert.
create function private.freeze_item_number() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.number := old.number;
  new.project_id := old.project_id;
  new.organization_id := old.organization_id;
  return new;
end $$;
create trigger tasks_freeze before update on public.tasks for each row execute function private.freeze_item_number();
create trigger issues_freeze before update on public.issues for each row execute function private.freeze_item_number();

-- completed_at / resolved_at follow the status category.
create function private.stamp_task_completion() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cat text;
begin
  select category into cat from public.options where id = new.status_id;
  if cat = 'completed' then
    new.completed_at := coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now());
  else
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_completion before insert or update of status_id on public.tasks
  for each row execute function private.stamp_task_completion();

create function private.stamp_issue_resolution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cat text;
begin
  select category into cat from public.options where id = new.status_id;
  if cat in ('resolved', 'closed') then
    new.resolved_at := coalesce(case when tg_op = 'UPDATE' then old.resolved_at end, now());
  else
    new.resolved_at := null;
  end if;
  return new;
end $$;
create trigger issues_resolution before insert or update of status_id on public.issues
  for each row execute function private.stamp_issue_resolution();

-- ---------------------------------------------------------------------------
-- Project access helpers
-- A user reads a project if their org role has projects.read_all, or they are
-- a project member. A project-level role, when set, replaces the org role.
-- ---------------------------------------------------------------------------
create function private.readable_project_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.projects p
  where p.organization_id in (select private.org_ids_with('projects.read_all'))
  union
  select pm.project_id from public.project_members pm
  where pm.user_id = (select auth.uid()) and pm.organization_id in (select private.my_org_ids())
$$;

create function private.project_ids_with(perm text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  -- Project-level role override.
  select pm.project_id
  from public.project_members pm
  join public.roles r on r.id = pm.role_id
  where pm.user_id = (select auth.uid())
    and pm.organization_id in (select private.my_org_ids())
    and perm = any (r.permissions)
  union
  -- Otherwise the organization role, for projects the user can read.
  select p.id
  from public.projects p
  where p.organization_id in (select private.org_ids_with(perm))
    and p.id in (select private.readable_project_ids())
    and not exists (
      select 1 from public.project_members pm
      where pm.project_id = p.id and pm.user_id = (select auth.uid()) and pm.role_id is not null)
$$;

revoke all on function private.readable_project_ids(), private.project_ids_with(text),
  private.assign_item_number(), private.stamp_task_completion(), private.stamp_issue_resolution() from public;
grant execute on function private.readable_project_ids(), private.project_ids_with(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients', 'labels', 'projects', 'project_members', 'project_pins', 'milestones',
    'releases', 'tasks', 'task_labels', 'task_dependencies', 'checklist_items', 'issues', 'comments',
    'attachments', 'documents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- clients / labels: every member reads; clients.manage / settings.manage write.
create policy clients_select on public.clients for select to authenticated
  using (organization_id in (select private.my_org_ids()));
create policy clients_write on public.clients for insert to authenticated
  with check (organization_id in (select private.org_ids_with('clients.manage')));
create policy clients_update on public.clients for update to authenticated
  using (organization_id in (select private.org_ids_with('clients.manage')))
  with check (organization_id in (select private.org_ids_with('clients.manage')));
create policy clients_delete on public.clients for delete to authenticated
  using (organization_id in (select private.org_ids_with('clients.manage')));

create policy labels_select on public.labels for select to authenticated
  using (organization_id in (select private.my_org_ids()));
create policy labels_insert on public.labels for insert to authenticated
  with check (organization_id in (select private.org_ids_with('settings.manage')));
create policy labels_update on public.labels for update to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')))
  with check (organization_id in (select private.org_ids_with('settings.manage')));
create policy labels_delete on public.labels for delete to authenticated
  using (organization_id in (select private.org_ids_with('settings.manage')));

-- projects
create policy projects_select on public.projects for select to authenticated
  using (id in (select private.readable_project_ids()));
create policy projects_insert on public.projects for insert to authenticated
  with check (organization_id in (select private.org_ids_with('projects.create')) and created_by = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated
  using (id in (select private.project_ids_with('projects.update')))
  with check (id in (select private.project_ids_with('projects.update')));
-- Hard delete only after archiving (the UI archives; delete is a deliberate second step).
create policy projects_delete on public.projects for delete to authenticated
  using (id in (select private.project_ids_with('projects.delete')) and archived_at is not null);

create policy project_members_select on public.project_members for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy project_members_insert on public.project_members for insert to authenticated
  with check (project_id in (select private.project_ids_with('projects.update')));
create policy project_members_update on public.project_members for update to authenticated
  using (project_id in (select private.project_ids_with('projects.update')))
  with check (project_id in (select private.project_ids_with('projects.update')));
create policy project_members_delete on public.project_members for delete to authenticated
  using (project_id in (select private.project_ids_with('projects.update')));

create policy project_pins_all on public.project_pins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and project_id in (select private.readable_project_ids()));

-- milestones / releases
create policy milestones_select on public.milestones for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (project_id in (select private.project_ids_with('releases.manage')));
create policy milestones_update on public.milestones for update to authenticated
  using (project_id in (select private.project_ids_with('releases.manage')))
  with check (project_id in (select private.project_ids_with('releases.manage')));
create policy milestones_delete on public.milestones for delete to authenticated
  using (project_id in (select private.project_ids_with('releases.manage')));

create policy releases_select on public.releases for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy releases_insert on public.releases for insert to authenticated
  with check (project_id in (select private.project_ids_with('releases.manage')));
create policy releases_update on public.releases for update to authenticated
  using (project_id in (select private.project_ids_with('releases.manage')))
  with check (project_id in (select private.project_ids_with('releases.manage')));
create policy releases_delete on public.releases for delete to authenticated
  using (project_id in (select private.project_ids_with('releases.manage')));

-- tasks and their children
create policy tasks_select on public.tasks for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (project_id in (select private.project_ids_with('tasks.create')) and reporter_id = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (project_id in (select private.project_ids_with('tasks.update')))
  with check (project_id in (select private.project_ids_with('tasks.update')));
create policy tasks_delete on public.tasks for delete to authenticated
  using (project_id in (select private.project_ids_with('tasks.delete')));

create policy task_labels_select on public.task_labels for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_labels_write on public.task_labels for insert to authenticated
  with check (project_id in (select private.project_ids_with('tasks.update')));
create policy task_labels_delete on public.task_labels for delete to authenticated
  using (project_id in (select private.project_ids_with('tasks.update')));

create policy task_dependencies_select on public.task_dependencies for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy task_dependencies_write on public.task_dependencies for insert to authenticated
  with check (project_id in (select private.project_ids_with('tasks.update')));
create policy task_dependencies_delete on public.task_dependencies for delete to authenticated
  using (project_id in (select private.project_ids_with('tasks.update')));

create policy checklist_select on public.checklist_items for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy checklist_insert on public.checklist_items for insert to authenticated
  with check (project_id in (select private.project_ids_with('tasks.update')));
create policy checklist_update on public.checklist_items for update to authenticated
  using (project_id in (select private.project_ids_with('tasks.update')))
  with check (project_id in (select private.project_ids_with('tasks.update')));
create policy checklist_delete on public.checklist_items for delete to authenticated
  using (project_id in (select private.project_ids_with('tasks.update')));

-- issues
create policy issues_select on public.issues for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy issues_insert on public.issues for insert to authenticated
  with check (project_id in (select private.project_ids_with('issues.create')) and reporter_id = (select auth.uid()));
create policy issues_update on public.issues for update to authenticated
  using (project_id in (select private.project_ids_with('issues.update')))
  with check (project_id in (select private.project_ids_with('issues.update')));
create policy issues_delete on public.issues for delete to authenticated
  using (project_id in (select private.project_ids_with('issues.delete')));

-- comments: anyone who can work on the project writes; authors edit their own.
create policy comments_select on public.comments for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (project_id in (select private.project_ids_with('tasks.update'))
         or project_id in (select private.project_ids_with('issues.update'))));
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and project_id in (select private.readable_project_ids()))
  with check (author_id = (select auth.uid()));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or project_id in (select private.project_ids_with('tasks.delete')));

create policy attachments_select on public.attachments for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (project_id in (select private.project_ids_with('tasks.update'))
         or project_id in (select private.project_ids_with('issues.update'))));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = (select auth.uid()) or project_id in (select private.project_ids_with('tasks.delete')));

create policy documents_select on public.documents for select to authenticated
  using (project_id in (select private.readable_project_ids()));
create policy documents_insert on public.documents for insert to authenticated
  with check (project_id in (select private.project_ids_with('docs.edit')));
create policy documents_update on public.documents for update to authenticated
  using (project_id in (select private.project_ids_with('docs.edit')))
  with check (project_id in (select private.project_ids_with('docs.edit')));
create policy documents_delete on public.documents for delete to authenticated
  using (project_id in (select private.project_ids_with('docs.edit')));

-- Progress per project, computed in the database (never by downloading tasks).
create view public.project_progress with (security_invoker = true) as
  select t.project_id,
         count(*)::int as total,
         count(*) filter (where o.category = 'completed')::int as done
  from public.tasks t
  join public.options o on o.id = t.status_id
  group by t.project_id;
revoke all on public.project_progress from anon, authenticated;
grant select on public.project_progress to authenticated, service_role;
