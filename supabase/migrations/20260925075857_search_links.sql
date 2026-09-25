-- Search results link straight to the item: tasks open their drawer, documents their page.
create or replace function public.search_org(p_org uuid, p_query text) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  pat text;
begin
  if char_length(btrim(coalesce(p_query, ''))) < 2 then
    return '[]'::jsonb;
  end if;
  pat := '%' || replace(replace(replace(left(btrim(p_query), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((
    select jsonb_agg(h) from (
      (select jsonb_build_object('group', 'Projects', 'id', p.id, 'key', null, 'title', p.name,
              'meta', o.name, 'href', '/projects/' || lower(p.key)) as h
       from public.projects p join public.options o on o.id = p.type_id
       where p.organization_id = p_org and p.archived_at is null and (p.name ilike pat or p.key ilike pat)
       order by p.name limit 5)
      union all
      (select jsonb_build_object('group', 'Tasks', 'id', t.id, 'key', p.key || '-' || t.number, 'title', t.title,
              'meta', p.name || ' · ' || o.name,
              'href', '/projects/' || lower(p.key) || '?task=' || lower(p.key) || '-' || t.number)
       from public.tasks t join public.projects p on p.id = t.project_id join public.options o on o.id = t.status_id
       where t.organization_id = p_org and (t.title ilike pat or (p.key || '-' || t.number) ilike pat)
       order by t.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'Issues', 'id', i.id, 'key', p.key || '-' || i.number, 'title', i.title,
              'meta', o.name, 'href', '/issues?issue=' || lower(p.key) || '-' || i.number)
       from public.issues i join public.projects p on p.id = i.project_id join public.options o on o.id = i.severity_id
       where i.organization_id = p_org and (i.title ilike pat or (p.key || '-' || i.number) ilike pat)
       order by i.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'Clients', 'id', c.id, 'key', null, 'title', c.name,
              'meta', c.industry, 'href', '/clients?client=' || c.id)
       from public.clients c
       where c.organization_id = p_org and c.archived_at is null and (c.name ilike pat or c.contact_name ilike pat)
       order by c.name limit 5)
      union all
      (select jsonb_build_object('group', 'Documents', 'id', d.id, 'key', null, 'title', p.name || ' · ' || d.title,
              'meta', 'Document', 'href', '/docs/' || d.id)
       from public.documents d join public.projects p on p.id = d.project_id
       where d.organization_id = p_org and d.title ilike pat
       order by d.updated_at desc limit 5)
      union all
      (select jsonb_build_object('group', 'People', 'id', pr.id, 'key', null, 'title', pr.full_name,
              'meta', r.name, 'href', '/team')
       from public.organization_members m
       join public.profiles pr on pr.id = m.user_id
       join public.roles r on r.id = m.role_id
       where m.organization_id = p_org and (pr.full_name ilike pat or pr.email ilike pat)
       order by pr.full_name limit 5)
    ) hits), '[]'::jsonb);
end $$;
