-- Covering indexes that match the composite foreign keys column-for-column
-- (flagged by the Supabase linter). They replace narrower indexes where the new
-- one serves the same queries.

drop index public.projects_type_idx;
drop index public.projects_status_idx;
drop index public.projects_priority_idx;
create index projects_type_fk_idx on public.projects (organization_id, type_id, type_kind);
create index projects_status_fk_idx on public.projects (organization_id, status_id, status_kind);
create index projects_priority_fk_idx on public.projects (organization_id, priority_id, priority_kind);

create index project_members_project_fk_idx on public.project_members (organization_id, project_id);

drop index public.releases_status_idx;
create index releases_status_fk_idx on public.releases (organization_id, status_id, status_kind);

drop index public.tasks_org_idx;
drop index public.tasks_status_idx;
drop index public.tasks_priority_idx;
create index tasks_project_fk_idx on public.tasks (organization_id, project_id);
create index tasks_status_fk_idx on public.tasks (organization_id, status_id, status_kind);
create index tasks_priority_fk_idx on public.tasks (organization_id, priority_id, priority_kind);

drop index public.issues_org_status_idx;
drop index public.issues_org_severity_idx;
drop index public.issues_org_priority_idx;
create index issues_project_fk_idx on public.issues (organization_id, project_id);
create index issues_status_fk_idx on public.issues (organization_id, status_id, status_kind);
create index issues_severity_fk_idx on public.issues (organization_id, severity_id, severity_kind);
create index issues_priority_fk_idx on public.issues (organization_id, priority_id, priority_kind);

create index activity_project_fk_idx on public.activity (organization_id, project_id);
