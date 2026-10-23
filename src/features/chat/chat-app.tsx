"use client";

import { ChevronLeft, Folder, Hash, LogOut, MessageSquarePlus, Send, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { setOpenChannel } from "@/lib/chat-focus";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ChatChannel } from "./queries";

interface Message {
  id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  pending?: boolean;
}

const PAGE = 100;
const MESSAGE_COLUMNS = "id, channel_id, author_id, body, created_at";

/** Team chat: channel list on the left, the open conversation on the right (one at a time on phones). */
export function ChatApp({ initialChannels, initialChannelId }: { initialChannels: ChatChannel[]; initialChannelId: string | null }) {
  const { org, projects, members, member, currentUserId } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const firstId = initialChannels.find((c) => c.id === initialChannelId)?.id ?? initialChannels.find((c) => c.kind === "general")?.id ?? null;
  const [channels, setChannels] = useState(() => initialChannels.map((c) => (c.id === firstId ? { ...c, unread: 0 } : c)));
  const [selectedId, setSelectedId] = useState<string | null>(firstId);
  const tempSeq = useRef(0);
  // Phones show the list or the conversation; a link with ?c= opens the conversation.
  const [mobileOpen, setMobileOpen] = useState(Boolean(initialChannelId));
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "direct" | "group" | "add">(null);
  // The open channel, for the Realtime handler (which subscribes once).
  const selectedRef = useRef(selectedId);

  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const projectName = useCallback((id: string | null) => projects.find((p) => p.id === id)?.name ?? "Project", [projects]);
  const title = useCallback(
    (c: ChatChannel) =>
      c.kind === "general" ? "General" : c.kind === "project" ? projectName(c.projectId) : c.kind === "group" ? c.name ?? "Group" : member(c.otherUserId)?.name ?? "Former member",
    [projectName, member],
  );
  const selected = channels.find((c) => c.id === selectedId) ?? null;

  const refreshChannels = useCallback(async () => {
    const { data } = await supabaseBrowser().rpc("chat_overview", { p_org: org.id });
    if (data) {
      setChannels(
        data.map((c) => ({
          id: c.id, kind: c.kind as ChatChannel["kind"], name: c.name, projectId: c.project_id,
          otherUserId: c.other_user_id, lastMessageAt: c.last_message_at, unread: c.id === selectedRef.current ? 0 : c.unread,
        })),
      );
    }
  }, [org.id]);

  // Marks read on the server, then refreshes so the sidebar's unread badge updates.
  const markReadRemote = useCallback(
    (id: string) => void supabaseBrowser().rpc("mark_chat_read", { p_channel: id }).then(() => router.refresh()),
    [router],
  );

  // The channel opened by the URL counts as read.
  useEffect(() => {
    if (firstId) markReadRemote(firstId);
    // Once, for the channel the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open a channel: load its latest messages and keep the URL shareable.
  useEffect(() => {
    selectedRef.current = selectedId;
    setOpenChannel(selectedId);
    if (!selectedId) return;
    window.history.replaceState(null, "", `?c=${selectedId}`);
    if (messages[selectedId]) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabaseBrowser()
        .from("chat_messages")
        .select(MESSAGE_COLUMNS)
        .eq("channel_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (cancelled) return;
      if (error) setLoadError(friendlyError(error, "load messages"));
      else {
        setLoadError(null);
        setMessages((m) => ({ ...m, [selectedId]: (data ?? []).reverse() }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // messages is read only to skip channels already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => () => setOpenChannel(null), []);

  // Live messages for every channel in this organization (RLS filters per person).
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb
      .channel(`chat:${org.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `organization_id=eq.${org.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((m) => {
          const list = m[msg.channel_id];
          if (!list) return m;
          if (list.some((x) => x.id === msg.id)) return m;
          return { ...m, [msg.channel_id]: [...list, msg] };
        });
        setChannels((cs) => {
          if (!cs.some((c) => c.id === msg.channel_id)) {
            void refreshChannels();
            return cs;
          }
          return cs.map((c) =>
            c.id === msg.channel_id
              ? { ...c, lastMessageAt: msg.created_at, unread: c.id === selectedRef.current || msg.author_id === currentUserId ? 0 : c.unread + 1 }
              : c,
          );
        });
        if (msg.channel_id === selectedRef.current && msg.author_id !== currentUserId && !document.hidden) {
          void sb.rpc("mark_chat_read", { p_channel: msg.channel_id });
        }
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [org.id, currentUserId, refreshChannels]);

  async function send(body: string) {
    if (!selected) return false;
    tempSeq.current += 1;
    const temp: Message = { id: `temp-${tempSeq.current}`, channel_id: selected.id, author_id: currentUserId, body, created_at: new Date().toISOString(), pending: true };
    setMessages((m) => ({ ...m, [selected.id]: [...(m[selected.id] ?? []), temp] }));
    const { data, error } = await supabaseBrowser()
      .from("chat_messages")
      .insert({ organization_id: org.id, channel_id: selected.id, body })
      .select(MESSAGE_COLUMNS)
      .single();
    setMessages((m) => {
      const rest = (m[selected.id] ?? []).filter((x) => x.id !== temp.id);
      if (!data || rest.some((x) => x.id === data.id)) return { ...m, [selected.id]: rest };
      return { ...m, [selected.id]: [...rest, data] };
    });
    if (error) {
      toast({ message: friendlyError(error, "send that") });
      return false;
    }
    return true;
  }

  async function remove(msg: Message) {
    setMessages((m) => ({ ...m, [msg.channel_id]: (m[msg.channel_id] ?? []).filter((x) => x.id !== msg.id) }));
    const { error } = await supabaseBrowser().from("chat_messages").delete().eq("id", msg.id);
    if (error) {
      toast({ message: friendlyError(error, "delete that") });
      setMessages((m) => ({ ...m, [msg.channel_id]: [...(m[msg.channel_id] ?? []), msg].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
    }
  }

  async function leave(c: ChatChannel) {
    const { error } = await supabaseBrowser().from("chat_members").delete().eq("channel_id", c.id).eq("user_id", currentUserId);
    if (error) return toast({ message: friendlyError(error, "leave the group") });
    setChannels((cs) => cs.filter((x) => x.id !== c.id));
    setSelectedId(channels.find((x) => x.kind === "general")?.id ?? null);
    setMobileOpen(false);
  }

  function open(id: string) {
    setSelectedId(id);
    setMobileOpen(true);
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    markReadRemote(id);
  }

  const sections: { label: string; items: ChatChannel[] }[] = [
    { label: "Channels", items: channels.filter((c) => c.kind === "general") },
    { label: "Projects", items: channels.filter((c) => c.kind === "project").sort((a, b) => title(a).localeCompare(title(b))) },
    { label: "Groups", items: channels.filter((c) => c.kind === "group").sort(byRecent) },
    { label: "Direct messages", items: channels.filter((c) => c.kind === "direct").sort(byRecent) },
  ];

  return (
    <div className="flex min-h-0 grow lg:h-[calc(100dvh-52px)]">
      <aside
        aria-label="Conversations"
        className={cn("w-full shrink-0 flex-col overflow-y-auto border-line bg-surface lg:flex lg:w-[280px] lg:border-r", mobileOpen ? "hidden" : "flex")}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h1 className="grow text-xl font-semibold">Chat</h1>
          <Button size="sm" onClick={() => setDialog("direct")} className="max-lg:h-10">
            <MessageSquarePlus aria-hidden className="size-4" /> Message
          </Button>
          <Button size="sm" onClick={() => setDialog("group")} aria-label="New group" className="max-lg:h-10 max-lg:w-10">
            <Users aria-hidden className="size-4" />
          </Button>
        </div>
        {sections.map((s) =>
          s.items.length ? (
            <div key={s.label} className="flex flex-col px-2 pb-2">
              <p className="px-2.5 pt-3 pb-1 text-xs font-medium text-ink-4">{s.label}</p>
              {s.items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => open(c.id)}
                  aria-current={c.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-base max-lg:h-11",
                    c.id === selectedId ? "bg-muted font-medium text-ink" : "text-ink-2 hover:bg-subtle",
                    c.unread > 0 && "font-semibold text-ink",
                  )}
                >
                  <ChannelIcon channel={c} person={member(c.otherUserId)} />
                  <span className="min-w-0 grow truncate">{title(c)}</span>
                  {c.unread > 0 ? (
                    <span className="rounded-full bg-accent px-1.5 text-2xs leading-[18px] font-semibold text-white tabular">
                      {c.unread > 99 ? "99+" : c.unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null,
        )}
        {!channels.some((c) => c.kind === "direct" || c.kind === "group") ? (
          <p className="px-5 pt-2 pb-5 text-xs text-ink-4">Start a direct message or a group with the buttons above.</p>
        ) : null}
      </aside>

      <section aria-label={selected ? title(selected) : "Conversation"} className={cn("min-w-0 grow flex-col bg-canvas lg:flex", mobileOpen ? "flex" : "hidden")}>
        {selected ? (
          <Conversation
            key={selected.id}
            channel={selected}
            title={title(selected)}
            messages={messages[selected.id]}
            loadError={loadError}
            onBack={() => setMobileOpen(false)}
            onSend={send}
            onDelete={remove}
            onLeave={() => leave(selected)}
            onAddPeople={() => setDialog("add")}
          />
        ) : (
          <div className="p-6">
            <EmptyState icon={Hash} title="No conversation selected">Pick a channel or start a direct message.</EmptyState>
          </div>
        )}
      </section>

      <PeopleDialog
        mode={dialog}
        people={activeMembers.filter((m) => m.id !== currentUserId)}
        onClose={() => setDialog(null)}
        onDone={async (id) => {
          setDialog(null);
          await refreshChannels();
          if (id) open(id);
        }}
        channelId={selected?.id ?? null}
      />
    </div>
  );
}

function byRecent(a: ChatChannel, b: ChatChannel) {
  return (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "");
}

function ChannelIcon({ channel, person }: { channel: ChatChannel; person: Member | undefined }) {
  if (channel.kind === "direct") return <Avatar person={person} size="xs" />;
  const Icon = channel.kind === "general" ? Hash : channel.kind === "project" ? Folder : Users;
  return <Icon aria-hidden className="size-4 shrink-0 text-ink-4" strokeWidth={1.7} />;
}

function Conversation({
  channel,
  title,
  messages,
  loadError,
  onBack,
  onSend,
  onDelete,
  onLeave,
  onAddPeople,
}: {
  channel: ChatChannel;
  title: string;
  messages: Message[] | undefined;
  loadError: string | null;
  onBack: () => void;
  onSend: (body: string) => Promise<boolean>;
  onDelete: (m: Message) => void;
  onLeave: () => void;
  onAddPeople: () => void;
}) {
  const { member, currentUserId } = useOrg();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = messages?.length ?? 0;

  // Stay pinned to the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    if (body.length > 4000) return;
    setDraft("");
    if (!(await onSend(body))) setDraft(body);
  }

  const subtitle =
    channel.kind === "general" ? "Everyone in the organization" : channel.kind === "project" ? "Everyone on this project" : channel.kind === "group" ? "Group" : "Direct message";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:px-5">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="inline-flex size-11 items-center justify-center rounded-md text-ink-3 hover:bg-subtle lg:hidden">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className="flex min-w-0 grow flex-col leading-tight">
          <h2 className="truncate text-md font-semibold">{title}</h2>
          <span className="text-xs text-ink-4">{subtitle}</span>
        </div>
        {channel.kind === "group" ? (
          <>
            <Button size="sm" variant="ghost" onClick={onAddPeople} className="max-lg:h-10">
              <UserPlus aria-hidden className="size-4" /> <span className="max-sm:sr-only">Add people</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={onLeave} className="max-lg:h-10">
              <LogOut aria-hidden className="size-4" /> <span className="max-sm:sr-only">Leave</span>
            </Button>
          </>
        ) : null}
      </header>

      <div ref={listRef} className="min-h-0 grow overflow-y-auto px-3 py-4 lg:px-6" aria-live="polite">
        {loadError ? (
          <ErrorState message={loadError} />
        ) : !messages ? (
          <div role="status" aria-label="Loading messages" className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 rounded-full" />
                <div className="flex grow flex-col gap-2">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className={cn("h-2.5", i % 2 ? "w-2/5" : "w-3/5")} />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState icon={Hash} title={`This is the start of ${title}`}>Say hello. Messages here are visible to {subtitle.toLowerCase()}.</EmptyState>
        ) : (
          <ol className="flex flex-col">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const grouped = prev && prev.author_id === m.author_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const author = member(m.author_id);
              return (
                <li key={m.id} className="flex flex-col">
                  {newDay ? (
                    <div className="my-3 flex items-center gap-3 text-xs text-ink-4">
                      <span className="h-px grow bg-line" />
                      {new Date(m.created_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                      <span className="h-px grow bg-line" />
                    </div>
                  ) : null}
                  <div className={cn("group flex gap-3 rounded-md px-2 py-0.5 hover:bg-surface", !grouped && "mt-2.5", m.pending && "opacity-60")}>
                    <span className="w-7 shrink-0">{grouped && !newDay ? null : <Avatar person={author} size="md" />}</span>
                    <div className="min-w-0 grow">
                      {grouped && !newDay ? null : (
                        <p className="flex items-baseline gap-2">
                          <span className="text-base font-semibold">{author?.name ?? "Former member"}</span>
                          <time dateTime={m.created_at} className="text-2xs text-ink-4">
                            {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </time>
                        </p>
                      )}
                      <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap text-ink">{m.body}</p>
                    </div>
                    {m.author_id === currentUserId && !m.pending ? (
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        aria-label="Delete message"
                        className="inline-flex size-8 shrink-0 items-center justify-center self-start rounded-md text-ink-4 opacity-0 group-hover:opacity-100 hover:bg-subtle hover:text-danger-ink focus-visible:opacity-100 max-lg:opacity-100"
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="shrink-0 border-t border-line bg-surface p-3 lg:px-6"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-draft" className="sr-only">Message {title}</label>
          <Textarea
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={`Message ${title}`}
            rows={1}
            maxLength={4000}
            className="max-h-40 min-h-[38px] resize-none py-2"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()} aria-label="Send" className="h-[38px] w-[38px] p-0 max-lg:h-11 max-lg:w-11">
            <Send aria-hidden className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 hidden text-2xs text-ink-4 lg:block">Enter to send · Shift + Enter for a new line</p>
      </form>
    </>
  );
}

/** Pick people: one for a direct message, several for a new group or to add to one. */
function PeopleDialog({
  mode,
  people,
  channelId,
  onClose,
  onDone,
}: {
  mode: null | "direct" | "group" | "add";
  people: Member[];
  channelId: string | null;
  onClose: () => void;
  onDone: (channelId: string | null) => void;
}) {
  const { org } = useOrg();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shown = people.filter((p) => `${p.name} ${p.email ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  function reset() {
    setName("");
    setQuery("");
    setPicked(new Set());
    setError(null);
  }

  async function startDirect(id: string) {
    setPending(true);
    const { data, error } = await supabaseBrowser().rpc("open_direct_chat", { p_org: org.id, p_user: id });
    setPending(false);
    if (error) return setError(friendlyError(error, "start the chat"));
    reset();
    onDone(data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "group" && !name.trim()) return setError("Give the group a name.");
    if (!picked.size) return setError("Choose at least one person.");
    setPending(true);
    const db = supabaseBrowser();
    const res =
      mode === "group"
        ? await db.rpc("create_group_chat", { p_org: org.id, p_name: name.trim(), p_members: [...picked] })
        : await db.rpc("add_chat_members", { p_channel: channelId!, p_members: [...picked] });
    setPending(false);
    if (res.error) return setError(friendlyError(res.error, mode === "group" ? "create the group" : "add people"));
    const id = mode === "group" ? (res.data as string) : channelId;
    reset();
    onDone(id);
  }

  const title = mode === "direct" ? "New message" : mode === "group" ? "New group" : "Add people";

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent
        title={title}
        description={mode === "direct" ? "Choose who to message." : "Choose members of this organization."}
        footer={
          mode === "direct" ? undefined : (
            <Button variant="primary" type="submit" form="people-form" disabled={pending} className="max-lg:h-11">
              {pending ? "Saving…" : mode === "group" ? "Create group" : "Add"}
            </Button>
          )
        }
      >
        <form id="people-form" onSubmit={submit} className="flex flex-col gap-3">
          {error ? <ErrorState message={error} /> : null}
          {mode === "group" ? (
            <Field label="Group name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Design review" autoFocus />}</Field>
          ) : null}
          <Field label="Search people">{(p) => <Input {...p} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" autoFocus={mode !== "group"} />}</Field>
          {shown.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-4">{people.length ? "No one matches." : "Invite teammates first, then you can chat with them."}</p>
          ) : (
            <ul className="flex max-h-[320px] flex-col overflow-y-auto">
              {shown.map((p) => (
                <li key={p.id}>
                  {mode === "direct" ? (
                    <button type="button" disabled={pending} onClick={() => startDirect(p.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-subtle max-lg:py-3">
                      <Avatar person={p} size="md" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-base font-medium">{p.name}</span>
                        <span className="truncate text-xs text-ink-4">{p.email}</span>
                      </span>
                    </button>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-subtle max-lg:py-3">
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          setPicked(next);
                        }}
                        className="size-4 accent-accent"
                      />
                      <Avatar person={p} size="md" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-base font-medium">{p.name}</span>
                        <span className="truncate text-xs text-ink-4">{p.email}</span>
                      </span>
                    </label>
                  )}
                </li>
              ))}
            </ul>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
