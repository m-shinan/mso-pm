-- INSERT ... RETURNING on projects failed: readable_project_ids() is STABLE and
-- reads projects with the statement's snapshot, so the row being inserted is not
-- in it yet. Check the row's own organization instead of looking its id up.

create function private.member_project_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select pm.project_id from public.project_members pm
  where pm.user_id = (select auth.uid()) and pm.organization_id in (select private.my_org_ids())
$$;
revoke all on function private.member_project_ids() from public;
grant execute on function private.member_project_ids() to authenticated;

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    organization_id in (select private.org_ids_with('projects.read_all'))
    or id in (select private.member_project_ids()));
