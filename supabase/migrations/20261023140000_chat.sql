-- Team chat. Four kinds of channel per organization:
--   general  one per organization, every active member
--   project  one per project, whoever can read the project
--   group    named, with an explicit member list
--   direct   two people, with an explicit member list
-- Who can read a channel is decided in one place, private.chat_channel_ids().

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('general', 'project', 'group', 'direct')),
  project_id uuid,
  name text check (char_length(btrim(name)) between 1 and 80),
  -- "<smaller uuid>:<larger uuid>" so a pair of people has one direct chat.
  direct_key text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, project_id) references public.projects (organization_id, id) on delete cascade,
  check ((kind = 'project') = (project_id is not null)),
  check ((kind = 'direct') = (direct_key is not null)),
  check (kind <> 'group' or name is not null)
);
create unique index chat_channels_one_general on public.chat_channels (organization_id) where kind = 'general';
create unique index chat_channels_one_per_project on public.chat_channels (project_id) where kind = 'project';
create unique index chat_channels_one_direct on public.chat_channels (organization_id, direct_key) where kind = 'direct';
create index chat_channels_created_by on public.chat_channels (created_by);

create table public.chat_members (
  channel_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (channel_id, user_id),
  foreign key (organization_id, channel_id) references public.chat_channels (organization_id, id) on delete cascade
);
create index chat_members_user on public.chat_members (user_id);
create index chat_members_org_channel on public.chat_members (organization_id, channel_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel_id uuid not null,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  foreign key (organization_id, channel_id) references public.chat_channels (organization_id, id) on delete cascade
);
create index chat_messages_channel_time on public.chat_messages (channel_id, created_at desc);
create index chat_messages_org_channel on public.chat_messages (organization_id, channel_id);
create index chat_messages_author on public.chat_messages (author_id);

-- Where each person has read up to, per channel (unread counts).
create table public.chat_reads (
  channel_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id),
  foreign key (organization_id, channel_id) references public.chat_channels (organization_id, id) on delete cascade
);
create index chat_reads_user on public.chat_reads (user_id);
create index chat_reads_org_channel on public.chat_reads (organization_id, channel_id);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
create function private.chat_channel_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.chat_channels c
  where c.organization_id in (select private.my_org_ids())
    and (
      c.kind = 'general'
      or (c.kind = 'project' and c.project_id in (select private.readable_project_ids()))
      or (c.kind in ('group', 'direct') and exists (
            select 1 from public.chat_members m where m.channel_id = c.id and m.user_id = (select auth.uid())))
    )
$$;
revoke all on function private.chat_channel_ids() from public;
grant execute on function private.chat_channel_ids() to authenticated;

alter table public.chat_channels enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

grant select on public.chat_channels, public.chat_members to authenticated;
grant update (name) on public.chat_channels to authenticated;
grant select, delete on public.chat_messages to authenticated;
grant insert (organization_id, channel_id, body) on public.chat_messages to authenticated;
grant update (body, edited_at) on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chat_reads to authenticated;
grant delete on public.chat_members to authenticated;

create policy chat_channels_select on public.chat_channels for select to authenticated
  using (id in (select private.chat_channel_ids()));
-- Only the person who made a group can rename it.
create policy chat_channels_update on public.chat_channels for update to authenticated
  using (kind = 'group' and created_by = (select auth.uid()))
  with check (kind = 'group' and created_by = (select auth.uid()));

create policy chat_members_select on public.chat_members for select to authenticated
  using (channel_id in (select private.chat_channel_ids()));
-- Leave a group yourself. Adding people goes through add_chat_members().
create policy chat_members_delete on public.chat_members for delete to authenticated
  using (user_id = (select auth.uid())
         and exists (select 1 from public.chat_channels c where c.id = channel_id and c.kind = 'group'));

create policy chat_messages_select on public.chat_messages for select to authenticated
  using (channel_id in (select private.chat_channel_ids()));
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and channel_id in (select private.chat_channel_ids()));
create policy chat_messages_update on public.chat_messages for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (author_id = (select auth.uid()));

create policy chat_reads_all on public.chat_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and channel_id in (select private.chat_channel_ids()));

-- ---------------------------------------------------------------------------
-- Channels that exist automatically
-- ---------------------------------------------------------------------------
create function private.create_general_channel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_channels (organization_id, kind, name, created_by)
  values (new.id, 'general', 'General', null) on conflict do nothing;
  return new;
end $$;
create trigger organizations_general_channel after insert on public.organizations
  for each row execute function private.create_general_channel();

create function private.create_project_channel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_channels (organization_id, kind, project_id, name, created_by)
  values (new.organization_id, 'project', new.id, null, null) on conflict do nothing;
  return new;
end $$;
create trigger projects_chat_channel after insert on public.projects
  for each row execute function private.create_project_channel();

insert into public.chat_channels (organization_id, kind, name, created_by)
select id, 'general', 'General', null from public.organizations on conflict do nothing;
insert into public.chat_channels (organization_id, kind, project_id, created_by)
select organization_id, 'project', id, null from public.projects on conflict do nothing;

-- ---------------------------------------------------------------------------
-- New message: bump the channel, and tell the other people in a direct or
-- group chat (one unread chat notification per channel at a time).
-- ---------------------------------------------------------------------------
create function private.chat_message_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ch public.chat_channels;
  who text := coalesce((select nullif(full_name, '') from public.profiles where id = new.author_id), 'Someone');
  recipient uuid;
begin
  update public.chat_channels set last_message_at = new.created_at where id = new.channel_id returning * into ch;
  if ch.kind not in ('group', 'direct') then
    return new;
  end if;
  for recipient in
    select m.user_id from public.chat_members m
    where m.channel_id = ch.id and m.user_id <> new.author_id
      and not exists (
        select 1 from public.notifications n
        where n.user_id = m.user_id and n.kind = 'chat_message' and n.entity_id = ch.id and n.read_at is null)
  loop
    perform private.notify(ch.organization_id, recipient, 'chat_message', 'chat', ch.id,
      case when ch.kind = 'direct' then who || ': ' || left(new.body, 120)
           else who || ' in ' || ch.name || ': ' || left(new.body, 100) end,
      '/' || private.org_slug(ch.organization_id) || '/chat?c=' || ch.id);
  end loop;
  return new;
end $$;
create trigger chat_messages_after_insert after insert on public.chat_messages
  for each row execute function private.chat_message_after_insert();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function private.is_active_member(org uuid, person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members
                 where organization_id = org and user_id = person and status = 'active')
$$;

-- Open (or create) the direct chat between me and another member.
create function public.open_direct_chat(p_org uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  k text;
  ch_id uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_user = me or not private.is_active_member(p_org, me) or not private.is_active_member(p_org, p_user) then
    raise exception 'You can only message other members of this organization' using errcode = '42501';
  end if;
  k := least(me::text, p_user::text) || ':' || greatest(me::text, p_user::text);
  select c.id into ch_id from public.chat_channels c where c.organization_id = p_org and c.kind = 'direct' and c.direct_key = k;
  if ch_id is null then
    insert into public.chat_channels (organization_id, kind, direct_key, created_by)
    values (p_org, 'direct', k, me) returning chat_channels.id into ch_id;
    insert into public.chat_members (channel_id, organization_id, user_id)
    values (ch_id, p_org, me), (ch_id, p_org, p_user);
  end if;
  return ch_id;
end $$;

-- A named group with me plus the chosen members (non-members are ignored).
create function public.create_group_chat(p_org uuid, p_name text, p_members uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  ch_id uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if not private.is_active_member(p_org, me) then
    raise exception 'You''re not a member of this organization' using errcode = '42501';
  end if;
  if (select count(*) from public.chat_channels where organization_id = p_org and created_by = me and kind = 'group') >= 50 then
    raise exception 'Group limit reached' using errcode = '54000';
  end if;
  insert into public.chat_channels (organization_id, kind, name, created_by)
  values (p_org, 'group', btrim(p_name), me) returning chat_channels.id into ch_id;
  insert into public.chat_members (channel_id, organization_id, user_id)
  select ch_id, p_org, s.u from (select me as u union select unnest(p_members)) s
  where private.is_active_member(p_org, s.u)
  on conflict do nothing;
  return ch_id;
end $$;

-- Any member of a group can add other members of the organization.
create function public.add_chat_members(p_channel uuid, p_members uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ch public.chat_channels;
begin
  select * into ch from public.chat_channels where id = p_channel;
  if ch.kind is distinct from 'group' or not exists (
    select 1 from public.chat_members where channel_id = p_channel and user_id = (select auth.uid())) then
    raise exception 'You can only add people to a group you''re in' using errcode = '42501';
  end if;
  insert into public.chat_members (channel_id, organization_id, user_id)
  select p_channel, ch.organization_id, u from unnest(p_members) u
  where private.is_active_member(ch.organization_id, u)
  on conflict do nothing;
end $$;

-- Sidebar: every channel I can see in an organization, with unread counts.
create function public.chat_overview(p_org uuid)
returns table (id uuid, kind text, name text, project_id uuid, other_user_id uuid, last_message_at timestamptz, unread integer)
language sql stable set search_path = '' as $$
  select c.id, c.kind, c.name, c.project_id,
    (select m.user_id from public.chat_members m
      where c.kind = 'direct' and m.channel_id = c.id and m.user_id <> (select auth.uid()) limit 1),
    c.last_message_at,
    (select count(*)::integer from public.chat_messages msg
      where msg.channel_id = c.id and msg.author_id is distinct from (select auth.uid())
        and msg.created_at > coalesce(
          (select r.last_read_at from public.chat_reads r where r.channel_id = c.id and r.user_id = (select auth.uid())),
          '-infinity'::timestamptz))
  from public.chat_channels c
  where c.organization_id = p_org
$$;

-- Mark a channel read up to now (also clears its chat notification).
create function public.mark_chat_read(p_channel uuid) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.chat_reads (channel_id, organization_id, user_id, last_read_at)
  select c.id, c.organization_id, (select auth.uid()), now() from public.chat_channels c where c.id = p_channel
  on conflict (channel_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and kind = 'chat_message' and entity_id = p_channel and read_at is null;
end $$;

revoke all on function private.chat_message_after_insert(), private.create_general_channel(),
  private.create_project_channel(), private.is_active_member(uuid, uuid) from public;
revoke all on function public.open_direct_chat(uuid, uuid), public.create_group_chat(uuid, text, uuid[]),
  public.add_chat_members(uuid, uuid[]), public.chat_overview(uuid), public.mark_chat_read(uuid) from public, anon;
grant execute on function public.open_direct_chat(uuid, uuid), public.create_group_chat(uuid, text, uuid[]),
  public.add_chat_members(uuid, uuid[]), public.chat_overview(uuid), public.mark_chat_read(uuid) to authenticated;

alter publication supabase_realtime add table public.chat_messages;
