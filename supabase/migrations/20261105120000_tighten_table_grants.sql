-- feedback, admin_audit_log and the chat tables were created without the
-- `revoke all ... from anon, authenticated` the other tables get, so Supabase's
-- default privileges left anon and authenticated with full access (including
-- TRUNCATE, which ignores RLS) and made the column-level grants meaningless.
-- Revoke everything, then re-issue exactly the grants those migrations intended.

revoke all on public.feedback, public.admin_audit_log, public.chat_channels, public.chat_members,
  public.chat_messages, public.chat_reads from anon, authenticated;
grant all on public.feedback, public.admin_audit_log, public.chat_channels, public.chat_members,
  public.chat_messages, public.chat_reads to service_role;

-- 20261023120000_feedback_and_account.sql
grant select on public.feedback to authenticated;
grant insert (kind, subject, body, page, user_agent, organization_id) on public.feedback to authenticated;
grant update (status, resolved_at) on public.feedback to authenticated;

-- 20261023150000_super_admin.sql
grant select on public.admin_audit_log to authenticated;

-- 20261023140000_chat.sql
grant select on public.chat_channels, public.chat_members to authenticated;
grant update (name) on public.chat_channels to authenticated;
grant select, delete on public.chat_messages to authenticated;
grant insert (organization_id, channel_id, body) on public.chat_messages to authenticated;
grant update (body, edited_at) on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_reads to authenticated;
grant delete on public.chat_members to authenticated;

-- /api/cron/keepalive reads this with the public key to keep the free-tier
-- project awake. No policy applies to anon, so it always gets zero rows.
grant select on public.chat_channels to anon;
