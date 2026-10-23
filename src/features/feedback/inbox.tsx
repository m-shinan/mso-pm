"use client";

import { Inbox as InboxIcon, Reply } from "lucide-react";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface FeedbackItem {
  id: string;
  kind: "feature" | "issue";
  subject: string;
  body: string;
  page: string | null;
  userAgent: string | null;
  userName: string | null;
  userEmail: string | null;
  organizationName: string | null;
  status: "open" | "done";
  createdAt: string;
}

type Filter = "all" | "feature" | "issue";

const KIND = {
  feature: { label: "Feature request", className: "bg-accent-soft text-accent-hover" },
  issue: { label: "Issue", className: "bg-danger-soft text-danger-ink" },
};

/** Platform-admin inbox: list on the left, the selected item on the right (stacked on phones). */
export function FeedbackInbox({ initial, loadError }: { initial: FeedbackItem[]; loadError: string | null }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [showDone, setShowDone] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial.find((i) => i.status === "open")?.id ?? null);
  const toast = useToast();

  const pool = items.filter((i) => showDone || i.status === "open");
  const visible = pool.filter((i) => filter === "all" || i.kind === filter);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  async function setStatus(item: FeedbackItem, status: FeedbackItem["status"]) {
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, status } : i)));
    const { error } = await supabaseBrowser()
      .from("feedback")
      .update({ status, resolved_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) {
      setItems((all) => all.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
      toast({ message: friendlyError(error, "update this") });
    }
  }

  return (
    <div className="flex min-h-0 grow flex-col lg:flex-row">
      <section aria-label="Feedback" className="flex shrink-0 flex-col border-line bg-surface max-lg:border-b lg:w-[440px] lg:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          {(["all", "feature", "issue"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium max-lg:h-10",
                filter === f ? "border-inverse bg-inverse text-on-inverse" : "border-line-strong bg-surface text-ink-2 hover:bg-sunken",
              )}
            >
              {f === "all" ? "All" : f === "feature" ? "Features" : "Issues"}
              <span className={cn("tabular font-mono text-2xs", filter === f ? "opacity-70" : "text-ink-4")}>
                {pool.filter((i) => f === "all" || i.kind === f).length}
              </span>
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-accent" />
            Show done
          </label>
        </div>
        {loadError ? (
          <div className="p-4"><ErrorState message={loadError} /></div>
        ) : visible.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={InboxIcon} title={items.length ? "Inbox zero" : "No feedback yet"}>
              {items.length ? "Nothing open here." : "Requests and reports show up here as people send them."}
            </EmptyState>
          </div>
        ) : (
          <ul className="max-h-[50dvh] overflow-y-auto lg:max-h-none lg:grow">
            {visible.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(i.id)}
                  aria-current={i.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1.5 border-b border-line-soft px-4 py-3.5 text-left hover:bg-sunken",
                    i.id === selectedId && "bg-selected hover:bg-selected",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-px text-2xs font-medium", KIND[i.kind].className)}>{KIND[i.kind].label}</span>
                    <time dateTime={i.createdAt} suppressHydrationWarning className="text-xs text-ink-4">{timeAgo(i.createdAt)}</time>
                    {i.status === "done" ? <span className="ml-auto text-xs text-success-ink">Done</span> : null}
                  </span>
                  <span className={cn("text-md font-medium", i.status === "done" && "text-ink-4")}>{i.subject}</span>
                  <span className="truncate text-xs text-ink-4">
                    {i.userName || "Deleted user"}{i.organizationName ? ` · ${i.organizationName}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Selected feedback" className="min-w-0 grow px-4 py-6 lg:px-9 lg:py-7">
        {selected ? (
          <div className="flex max-w-[680px] flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", KIND[selected.kind].className)}>{KIND[selected.kind].label}</span>
              <time dateTime={selected.createdAt} suppressHydrationWarning className="text-sm text-ink-4">{timeAgo(selected.createdAt)}</time>
              <div className="ml-auto flex gap-2">
                {selected.userEmail ? (
                  <a
                    href={`mailto:${selected.userEmail}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}
                    className={buttonClass("secondary", "md", "max-lg:h-11")}
                  >
                    <Reply aria-hidden className="size-4" /> Reply by email
                  </a>
                ) : null}
                <Button
                  variant={selected.status === "open" ? "primary" : "secondary"}
                  onClick={() => setStatus(selected, selected.status === "open" ? "done" : "open")}
                  className="max-lg:h-11"
                >
                  {selected.status === "open" ? "Mark done" : "Reopen"}
                </Button>
              </div>
            </div>
            <h2 className="text-3xl leading-tight font-semibold tracking-[-0.015em]">{selected.subject}</h2>
            <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-2">{selected.body}</p>
            <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2.5 rounded-lg border border-line bg-surface px-4 py-3.5 text-sm">
              <dt className="text-ink-4">From</dt>
              <dd>{selected.userName || "Deleted user"}{selected.userEmail ? ` · ${selected.userEmail}` : ""}</dd>
              <dt className="text-ink-4">Organization</dt>
              <dd>{selected.organizationName ?? "None"}</dd>
              <dt className="text-ink-4">Page</dt>
              <dd className="font-mono text-xs break-all">{selected.page ?? "Unknown"}</dd>
              <dt className="text-ink-4">Browser</dt>
              <dd className="text-xs break-words text-ink-3">{selected.userAgent ?? "Unknown"}</dd>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-ink-4">Select an item to read it.</p>
        )}
      </section>
    </div>
  );
}
