-- Feedback to the mso-pm team, account deletion, reserved organization slugs.

-- ---------------------------------------------------------------------------
-- Platform admins: the people who read feedback. Not an organization role.
-- Lives in the private schema, so it is not reachable through the API.
-- ---------------------------------------------------------------------------
create table private.platform_admins (
  email text primary key check (email = lower(email))
);
-- Empty on purpose: each installation names its own admins with
-- `node --env-file=.env.local scripts/platform-admin.mjs you@example.org`.

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join private.platform_admins a on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  )
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

-- For the UI: show the inbox link only to admins. RLS still decides access.
create function public.is_platform_admin() returns boolean
language sql stable set search_path = '' as $$
  select private.is_platform_admin()
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Feedback: anyone signed in can send; only platform admins can read it.
-- ---------------------------------------------------------------------------
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('feature', 'issue')),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 5000),
  page text check (char_length(page) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  -- Snapshots, filled by the insert trigger: admins can't read other people's
  -- profiles, and the item should still say who sent it after they leave.
  user_name text,
  user_email text,
  organization_name text,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index feedback_created_at on public.feedback (created_at desc);
create index feedback_user_id on public.feedback (user_id, created_at desc);
create index feedback_organization_id on public.feedback (organization_id);

alter table public.feedback enable row level security;
grant select on public.feedback to authenticated;
grant insert (kind, subject, body, page, user_agent, organization_id) on public.feedback to authenticated;
grant update (status, resolved_at) on public.feedback to authenticated;

create policy feedback_insert on public.feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'open'
    and (organization_id is null or organization_id in (select private.my_org_ids()))
  );
create policy feedback_select on public.feedback for select to authenticated
  using ((select private.is_platform_admin()));
create policy feedback_update on public.feedback for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- At most 5 messages per person per hour, so the inbox and the email quota can't
-- be flooded. Also records who sent it.
create function private.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You''ve sent a lot of feedback in the last hour. Try again later.' using errcode = '54000';
  end if;
  select p.full_name, p.email into new.user_name, new.user_email from public.profiles p where p.id = new.user_id;
  select o.name into new.organization_name from public.organizations o where o.id = new.organization_id;
  return new;
end $$;
revoke all on function private.feedback_before_insert() from public;
create trigger feedback_before_insert before insert on public.feedback
  for each row execute function private.feedback_before_insert();

-- ---------------------------------------------------------------------------
-- One place that sends email through Resend (settings in Vault, see
-- scripts/email-setup.mjs). Asynchronous via pg_net and best effort: it never
-- raises, so the change that caused an email always goes through.
-- Recipients on example.com (reserved for testing, RFC 2606) are skipped.
-- ---------------------------------------------------------------------------
create function private.app_url() returns text
language sql stable security definer set search_path = '' as $$
  select rtrim(decrypted_secret, '/') from vault.decrypted_secrets where name = 'app_url'
$$;

create function private.send_email(
  p_to text[], p_subject text, p_text text, p_html text, p_reply_to text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  api_key text;
  sender text;
  recipients text[];
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into sender from vault.decrypted_secrets where name = 'email_from';
  select array_agg(r) into recipients from unnest(p_to) r where r is not null and r not like '%@example.com';
  if api_key is null or sender is null or recipients is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', sender, 'to', to_jsonb(recipients), 'reply_to', p_reply_to,
      'subject', left(p_subject, 200), 'text', p_text, 'html', p_html))
  );
exception when others then
  return;
end $$;

-- The house email layout: a heading, a body paragraph, an optional button and a footer line.
create function private.email_html(p_heading text, p_body text, p_button text, p_link text, p_footer text)
returns text
language sql immutable set search_path = '' as $$
  select '<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1b1b1f;max-width:520px">'
    || '<p style="margin:0 0 20px;font-weight:600;font-size:15px"><span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#2d55c8;color:#fff;text-align:center;line-height:22px;font-size:12px;margin-right:8px">m</span>mso-pm</p>'
    || '<p style="margin:0 0 10px;font-size:18px;font-weight:600">' || private.html_escape(p_heading) || '</p>'
    || '<p style="margin:0 0 20px;white-space:pre-line;color:#45454c">' || private.html_escape(coalesce(p_body, '')) || '</p>'
    || case when p_link is null then '' else
         '<p style="margin:0 0 24px"><a href="' || private.html_escape(p_link)
         || '" style="background:#2d55c8;color:#fff;padding:9px 16px;border-radius:7px;text-decoration:none;font-weight:500">'
         || private.html_escape(coalesce(p_button, 'Open mso-pm')) || '</a></p>' end
    || '<p style="margin:0;font-size:12px;color:#8a8a92">' || private.html_escape(coalesce(p_footer, '')) || '</p></div>'
$$;

revoke all on function private.app_url(), private.send_email(text[], text, text, text, text),
  private.email_html(text, text, text, text, text) from public;

-- Email each new item to every platform admin.
create function private.email_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  label text := case new.kind when 'issue' then 'Issue' else 'Feature request' end;
  who text := coalesce(nullif(new.user_name, ''), 'Unknown') || ' <' || coalesce(new.user_email, '?') || '>';
  link text := private.app_url() || '/feedback';
  details text;
begin
  -- Senders on example.com are the test suites; don't email about them.
  if coalesce(new.user_email, '') like '%@example.com' then
    return new;
  end if;
  details := new.body || E'\n\nFrom: ' || who || E'\nOrganization: ' || coalesce(new.organization_name, '-')
    || E'\nPage: ' || coalesce(new.page, '-') || E'\nBrowser: ' || coalesce(new.user_agent, '-');
  perform private.send_email(
    (select array_agg(email) from private.platform_admins),
    '[' || label || '] ' || left(new.subject, 120),
    label || ': ' || new.subject || E'\n\n' || details || E'\n\nInbox: ' || link,
    private.email_html(new.subject, details, 'Open the inbox', link, label || ' sent from mso-pm'),
    new.user_email);
  return new;
end $$;
revoke all on function private.email_feedback() from public;
create trigger feedback_email after insert on public.feedback
  for each row execute function private.email_feedback();


-- ---------------------------------------------------------------------------
-- Delete my account. Sole owners must hand over or delete their organization first
-- (the owner guard would refuse anyway; this gives a clear message).
-- Content they created stays with its organization; author columns become null.
-- ---------------------------------------------------------------------------
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  sole_org text;
  addr text;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select o.name into sole_org
  from public.organization_members m
  join public.roles r on r.id = m.role_id and r.key = 'owner'
  join public.organizations o on o.id = m.organization_id
  where m.user_id = uid and m.status = 'active'
    and not exists (
      select 1 from public.organization_members m2
      where m2.organization_id = m.organization_id and m2.role_id = m.role_id
        and m2.status = 'active' and m2.user_id <> uid)
  order by o.name
  limit 1;
  if sole_org is not null then
    raise exception 'You''re the only owner of %. Make someone else an owner, or delete the organization, first.', sole_org
      using errcode = '23514';
  end if;
  select email into addr from auth.users where id = uid;
  delete from auth.users where id = uid;
  -- Queued by pg_net; it only goes out if the delete commits.
  perform private.send_email(array[addr], 'Your mso-pm account was deleted',
    E'Your mso-pm account and sign-in details have been deleted.\n\nIf you didn''t do this, reply to this email straight away.',
    private.email_html('Your account was deleted',
      E'Your mso-pm account and sign-in details have been deleted. Content you created stays with its organization, without your name.\n\nIf you didn''t do this, reply to this email straight away.',
      null, null, 'Account email from mso-pm'));
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Organization slugs can't shadow the app's own top-level routes.
-- NOT VALID: checks new and changed slugs without failing on any existing one.
-- ---------------------------------------------------------------------------
alter table public.organizations add constraint organizations_slug_not_reserved check (
  slug not in ('login', 'signup', 'reset-password', 'onboarding', 'invite', 'auth', 'account', 'api',
               'app', 'privacy', 'terms', 'feedback', 'verify', 'admin')
) not valid;
