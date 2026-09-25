"use client";

import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const { member, currentUserId } = useOrg();
  return (
    <ol className="flex flex-col">
      {events.map((e) => {
        const who = member(e.actorId);
        return (
          <li key={e.id} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5 py-2">
            <Avatar person={who} />
            <span className="flex flex-col gap-0.5 text-sm leading-snug">
              <span>
                <span className="font-medium">{e.actorId === currentUserId ? "You" : who?.name.split(" ")[0]}</span>{" "}
                <span className="text-ink-3">{e.verb}</span> <span className={/^[A-Z]+-\d+$/.test(e.subject) ? "font-mono text-xs" : "font-medium"}>{e.subject}</span>{" "}
                <span className="text-ink-3">{e.detail}</span>
              </span>
              <time dateTime={e.at} suppressHydrationWarning className="text-xs text-ink-4">{timeAgo(e.at)}</time>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
