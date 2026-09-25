-- ============================================================================
-- Attachments storage, dependency-cycle guard, project-role escalation guard.
-- ============================================================================

-- Parse a path segment as uuid without erroring (policies must never throw).
create function private.try_uuid(t text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

create function private.project_in_org(project uuid, org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects where id = project and organization_id = org)
$$;

revoke all on function private.try_uuid(text), private.project_in_org(uuid, uuid) from public;
grant execute on function private.try_uuid(text), private.project_in_org(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Private bucket. Object path: {organization_id}/{project_id}/{task|issue}/{entity_id}/{uuid}-{filename}
-- Files are only reachable through short-lived signed URLs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "attachments: read in readable projects" on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.readable_project_ids())
  );

create policy "attachments: upload where you can work" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and private.project_in_org(private.try_uuid((storage.foldername(name))[2]), private.try_uuid((storage.foldername(name))[1]))
    and (
      private.try_uuid((storage.foldername(name))[2]) in (select private.project_ids_with('tasks.update'))
      or private.try_uuid((storage.foldername(name))[2]) in (select private.project_ids_with('issues.update'))
    )
  );

create policy "attachments: delete own or with tasks.delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      owner_id = (select auth.uid())::text
      or private.try_uuid((storage.foldername(name))[2]) in (select private.project_ids_with('tasks.delete'))
    )
  );

-- The metadata row must point at a path inside its own org/project folder.
alter table public.attachments
  add constraint attachments_path_matches check (
    storage_path like (organization_id::text || '/' || project_id::text || '/%')
  );

-- ---------------------------------------------------------------------------
-- Task dependencies: no loops (A blocked by B blocked by A).
-- ---------------------------------------------------------------------------
create function private.guard_dependency_cycle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    with recursive chain(id) as (
      select new.blocked_by_id
      union
      select d.blocked_by_id from public.task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'That would create a dependency loop' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger task_dependencies_no_cycle before insert on public.task_dependencies
  for each row execute function private.guard_dependency_cycle();

-- ---------------------------------------------------------------------------
-- Project-level roles can't be used to escalate: you may only assign a role
-- whose permissions you already have at the organization level, and never owner.
-- ---------------------------------------------------------------------------
create function private.guard_project_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  granted text[];
  mine text[];
begin
  if new.role_id is null or (select auth.uid()) is null then
    return new;
  end if;
  select permissions into granted from public.roles where id = new.role_id;
  if exists (select 1 from public.roles where id = new.role_id and key = 'owner') then
    raise exception 'The owner role can''t be given per project' using errcode = '42501';
  end if;
  select r.permissions into mine
  from public.organization_members m join public.roles r on r.id = m.role_id
  where m.organization_id = new.organization_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if not (coalesce(mine, '{}') @> coalesce(granted, '{}')) then
    raise exception 'You can only give roles with permissions you have yourself' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger project_members_role_guard before insert or update of role_id on public.project_members
  for each row execute function private.guard_project_role();

revoke all on function private.guard_dependency_cycle(), private.guard_project_role() from public;
