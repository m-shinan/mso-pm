"use client";

import { Bell, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isChannelOpen } from "@/lib/chat-focus";
import { playChime } from "@/lib/notify-sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { NotificationRow } from "@/features/misc/queries";

interface Popup {
  id: number;
  kind: string;
  title: string;
  href: string;
}

interface LiveNotifications {
  items: NotificationRow[];
  markRead: (ids: number[]) => void;
}

const Ctx = createContext<LiveNotifications>({ items: [], markRead: () => {} });

/** The bell's list, kept current by the provider below. */
export function useLiveNotifications() {
  return useContext(Ctx);
}

const SHOW_MS = 7000;
const KEEP = 15;

/**
 * One Realtime subscription per signed-in user feeds both the bell's list and
 * the corner pop-ups (with a chime). New rows are added in place instead of
 * re-rendering the page, which would re-run every query on it.
 */
export function LiveNotificationsProvider({
  userId,
  orgId,
  initial,
  children,
}: {
  userId: string;
  orgId: string;
  initial: NotificationRow[];
  children: ReactNode;
}) {
  const [items, setItems] = useState(initial);
  // Navigations bring a fresh server list; adopt it.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setItems(initial);
  }
  const [popups, setPopups] = useState<Popup[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const sb = supabaseBrowser();
    const all = timers.current;
    const dismiss = (id: number) => {
      clearTimeout(all.get(id));
      all.delete(id);
      setPopups((ps) => ps.filter((p) => p.id !== id));
    };
    const ch = sb
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as NotificationRow & { organization_id: string; entity_id: string | null };
          if (n.organization_id === orgId) {
            setItems((list) => (list.some((x) => x.id === n.id) ? list : [n, ...list].slice(0, KEEP)));
          }
          if (n.kind === "chat_message" && isChannelOpen(n.entity_id)) return;
          setPopups((ps) => [...ps.slice(-2), { id: n.id, kind: n.kind, title: n.title, href: n.href || "/app" }]);
          all.set(n.id, setTimeout(() => dismiss(n.id), SHOW_MS));
          playChime();
        },
      )
      .subscribe();
    return () => {
      all.forEach(clearTimeout);
      all.clear();
      void sb.removeChannel(ch);
    };
  }, [userId, orgId]);

  function markRead(ids: number[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    void supabaseBrowser().from("notifications").update({ read_at: now }).in("id", ids);
  }

  function close(id: number) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setPopups((ps) => ps.filter((p) => p.id !== id));
  }

  return (
    <Ctx.Provider value={{ items, markRead }}>
      {children}
      <div
        role="region"
        aria-label="New notifications"
        aria-live="polite"
        className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+12px)] right-3 left-3 z-[70] flex flex-col items-end gap-2 lg:top-4 lg:right-4 lg:left-auto"
      >
        {popups.map((p) => {
          const Icon = p.kind === "chat_message" ? MessageSquare : Bell;
          return (
            <div key={p.id} className="animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface py-3 pr-2 pl-3.5 shadow-pop">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-hover">
                <Icon aria-hidden className="size-4" />
              </span>
              <Link href={p.href} onClick={() => close(p.id)} className="min-w-0 grow py-0.5 text-sm leading-snug hover:text-accent">
                {p.title}
              </Link>
              <button type="button" onClick={() => close(p.id)} aria-label="Dismiss" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-4 hover:bg-subtle hover:text-ink">
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
