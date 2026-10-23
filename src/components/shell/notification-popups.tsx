"use client";

import { Bell, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isChannelOpen } from "@/lib/chat-focus";
import { playChime } from "@/lib/notify-sound";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Popup {
  id: number;
  kind: string;
  title: string;
  href: string;
}

const SHOW_MS = 7000;

/**
 * Corner pop-ups for notifications as they arrive (Realtime, RLS-filtered to
 * the signed-in user), with a chime. The bell's list refreshes on its own.
 */
export function NotificationPopups({ userId }: { userId: string }) {
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
      .channel(`popups:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { id: number; kind: string; title: string; href: string; entity_id: string | null };
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
  }, [userId]);

  function close(id: number) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setPopups((ps) => ps.filter((p) => p.id !== id));
  }

  return (
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
  );
}
