-- Live updates. Clients subscribe with postgres_changes filtered by project_id
-- (tasks, issues, comments) or user_id (notifications); Realtime applies each
-- table's RLS select policy per subscriber, so nobody receives rows they can't read.
alter publication supabase_realtime add table
  public.tasks, public.issues, public.comments, public.notifications;
