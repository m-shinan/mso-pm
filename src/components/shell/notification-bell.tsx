"use client";

import * as P from "@radix-ui/react-popover";
import { Bell } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiveNotifications } from "./notification-popups";
import { useOrg } from "./org-provider";

/** In-app notifications: the latest 15, kept live by LiveNotificationsProvider. */
export function NotificationBell({ className }: { className?: string }) {
  const { member } = useOrg();
  const { items: notifications, markRead } = useLiveNotifications();
  const unread = notifications.filter((n) => !n.read_at);

  function markAllRead() {
    markRead(unread.map((n) => n.id));
  }

  return (
    <P.Root onOpenChange={(open) => !open && unread.length && markAllRead()}>
      <P.Trigger
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
        className={cn("relative inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-3 hover:bg-sunken max-lg:size-11 max-lg:border-0 max-lg:bg-transparent", className)}
      >
        <Bell aria-hidden className="size-4 max-lg:size-5" strokeWidth={1.7} />
        {unread.length ? <span aria-hidden className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent max-lg:top-2.5 max-lg:right-2.5" /> : null}
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={6} className="animate-pop z-50 w-[340px] max-w-[calc(100vw-24px)] rounded-lg border border-line bg-surface shadow-pop outline-none">
          <div className="flex h-11 items-center justify-between border-b border-line-soft px-4">
            <span className="text-md font-semibold">Notifications</span>
            {unread.length ? <button type="button" onClick={markAllRead} className="text-sm text-accent">Mark all read</button> : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-4">Nothing yet. You’ll hear about work assigned to you and comments on it.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                return (
                  <li key={n.id}>
                    <Link href={n.href || "#"} className={cn("flex gap-2.5 border-b border-line-soft px-4 py-3 last:border-b-0 hover:bg-sunken", isUnread && "bg-accent-soft/50")}>
                      <Avatar person={member(n.actor_id)} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm leading-snug">{n.title}</span>
                        <span suppressHydrationWarning className="text-xs text-ink-4">{timeAgo(n.created_at)}</span>
                      </span>
                      {isUnread ? <span aria-label="Unread" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
