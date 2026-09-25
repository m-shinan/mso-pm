-- Email notifications: every in-app notification is also emailed through Resend,
-- sent asynchronously by pg_net so the user's action never waits on it.
-- Off until the three Vault secrets exist (scripts/email-setup.mjs):
--   resend_api_key, email_from ("mso-pm <notify@yourdomain>"), app_url.
create extension if not exists pg_net with schema extensions;

alter table public.profiles add column email_notifications boolean not null default true;
grant update (email_notifications) on public.profiles to authenticated;

create function private.html_escape(t text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(t, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create function private.email_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  api_key text;
  sender text;
  app_url text;
  addr text;
  wants boolean;
  org_name text;
  link text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into sender from vault.decrypted_secrets where name = 'email_from';
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'app_url';
  if api_key is null or sender is null or app_url is null then
    return new;
  end if;

  select p.email, p.email_notifications into addr, wants from public.profiles p where p.id = new.user_id;
  if not coalesce(wants, false) or addr is null or new.actor_id = new.user_id then
    return new;
  end if;

  select o.name into org_name from public.organizations o where o.id = new.organization_id;
  link := rtrim(app_url, '/') || coalesce(nullif(new.href, ''), '/');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', sender,
      'to', jsonb_build_array(addr),
      'subject', left(new.title, 150),
      'text', new.title || E'\n\nOpen: ' || link || E'\n\n' || coalesce(org_name, 'mso-pm')
        || E' · You can turn these emails off in the account menu.',
      'html', '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#2a2a30">'
        || '<p style="margin:0 0 16px">' || private.html_escape(new.title) || '</p>'
        || '<p style="margin:0 0 24px"><a href="' || private.html_escape(link)
        || '" style="background:#2d55c8;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open in mso-pm</a></p>'
        || '<p style="margin:0;font-size:12px;color:#8a8a92">' || private.html_escape(coalesce(org_name, 'mso-pm'))
        || ' · You can turn these emails off in the account menu.</p></div>'
    )
  );
  return new;
exception when others then
  -- Email is best effort; never block the change that caused the notification.
  return new;
end $$;

revoke all on function private.email_notification() from public;
revoke all on function private.html_escape(text) from public;

create trigger notifications_email after insert on public.notifications
  for each row execute function private.email_notification();
