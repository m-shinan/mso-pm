-- Security fixes from the October 2026 review.

-- 1. Inviters can only grant roles whose permissions they already hold
--    (a project manager could invite a second account of theirs as admin).
drop policy invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    organization_id in (select private.org_ids_with('members.invite'))
    and invited_by = (select auth.uid())
    and status = 'pending'
    -- Can't invite someone into the owner role.
    and role_id not in (select id from public.roles where key = 'owner')
    and (select r.permissions from public.roles r where r.id = invitations.role_id) <@ coalesce((
      select r.permissions
      from public.organization_members m join public.roles r on r.id = m.role_id
      where m.organization_id = invitations.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'
    ), '{}')
  );

-- 2. Accepting needs a confirmed email, and can't undo a deactivation
--    (only members.manage may restore someone an admin removed).
create or replace function public.accept_invitation(p_token text) returns text
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
  select lower(email) into my_email from auth.users where id = uid and email_confirmed_at is not null;
  select * into inv from public.invitations where token_hash = private.sha256_hex(p_token) for update;
  if not found or inv.status <> 'pending' or inv.expires_at < now() then
    raise exception 'This invitation is invalid or has expired' using errcode = 'P0002';
  end if;
  if my_email is null or inv.email <> my_email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  if exists (select 1 from public.organizations where id = inv.organization_id and archived_at is not null) then
    raise exception 'This organization is archived' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.organization_members
    where organization_id = inv.organization_id and user_id = uid and status = 'deactivated'
  ) then
    raise exception 'Your access to this organization was removed. Ask an admin to restore it.' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role_id)
  values (inv.organization_id, uid, inv.role_id)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations set status = 'accepted', accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set last_org_id = inv.organization_id where id = uid;
  select slug into org_slug from public.organizations where id = inv.organization_id;
  -- Kind added by the notifications migration later in this release.
  perform private.notify(inv.organization_id, inv.invited_by, 'invite_accepted', 'member', uid,
    coalesce((select nullif(full_name, '') from public.profiles where id = uid), my_email)
      || ' accepted your invitation to ' || (select name from public.organizations where id = inv.organization_id),
    '/' || org_slug || '/team');
  return org_slug;
end $$;

-- 3. Comment authors may edit the text only, not move a comment to another
--    organization, project or task (foreign keys don't check RLS).
revoke update on public.comments from authenticated;
grant update (body, edited_at) on public.comments to authenticated;

-- 4. A project membership can only change its role; the role guard trigger
--    fires on role_id, so reassigning user_id would have bypassed it.
revoke update on public.project_members from authenticated;
grant update (role_id) on public.project_members to authenticated;

-- 5. Projects stay in their organization.
create function private.freeze_project_org() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A project can''t move to another organization' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger projects_freeze_org before update on public.projects
  for each row execute function private.freeze_project_org();
revoke all on function private.freeze_project_org() from public;
