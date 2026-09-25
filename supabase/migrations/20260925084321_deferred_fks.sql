-- Deleting an organization failed when a project member had a project-level
-- role: the cascade removed the org's roles before its project_members, and the
-- NO ACTION foreign key fired mid-cascade. Check these "don't delete what's in
-- use" keys at commit instead. Deleting a single role/option/client that is
-- still referenced is still refused — just at the end of the transaction.
do $$
declare c record;
begin
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where con.contype = 'f'
      and n.nspname = 'public'
      and con.confdeltype = 'a'          -- NO ACTION
      and not con.condeferrable
  loop
    execute format('alter table public.%I alter constraint %I deferrable initially deferred', c.relname, c.conname);
  end loop;
end $$;
