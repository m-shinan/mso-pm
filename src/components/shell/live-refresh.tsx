"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface LiveSource {
  table: "tasks" | "issues" | "comments" | "notifications";
  /** Realtime filter, e.g. `project_id=eq.<uuid>`. RLS still decides what arrives. */
  filter: string;
}

/**
 * Re-renders the page when someone else changes something it shows.
 * Changes are coalesced into one refresh; while the tab is hidden nothing is
 * fetched, and a single refresh happens when it becomes visible again.
 * Only inserts and updates are watched: Realtime can't filter deletes.
 */
export function LiveRefresh({ channel, sources }: { channel: string; sources: LiveSource[] }) {
  const router = useRouter();
  const key = JSON.stringify(sources);

  useEffect(() => {
    const list = JSON.parse(key) as LiveSource[];
    const sb = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stale = false;

    const changed = () => {
      if (document.hidden) {
        stale = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 700);
    };
    const onVisibility = () => {
      if (!document.hidden && stale) {
        stale = false;
        router.refresh();
      }
    };

    const ch = sb.channel(channel);
    for (const s of list) {
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: s.table, filter: s.filter }, changed);
      ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: s.table, filter: s.filter }, changed);
    }
    ch.subscribe();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void sb.removeChannel(ch);
    };
  }, [channel, key, router]);

  return null;
}
