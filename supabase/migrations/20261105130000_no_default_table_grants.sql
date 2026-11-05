-- Supabase's default privileges give anon and authenticated full access to
-- every new table, which is how feedback, admin_audit_log and the chat tables
-- ended up wide open (see 20261105120000_tighten_table_grants.sql). From now
-- on, new tables in public start with no access for those roles: each
-- migration must grant exactly what the app needs. service_role is unchanged.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
