"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { buttonClass } from "@/components/ui/button";
import { StatusIcon } from "@/components/domain/markers";
import { MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarKind } from "./queries";

const KIND_STYLE: Record<CalendarKind, string> = {
  task: "text-ink",
  deadline: "bg-warn-soft font-medium text-warn-ink",
  milestone: "bg-subtle font-medium text-ink",
  release: "bg-accent-soft font-medium text-accent-hover",
};

function KindMark({ kind, late }: { kind: CalendarKind; late?: boolean }) {
  if (kind === "deadline") return <Flag aria-label="Deadline" className="size-3 shrink-0 text-[#C2560C]" strokeWidth={2.2} />;
  if (kind === "release") return <TagIcon aria-label="Release" className="size-3 shrink-0 text-accent" strokeWidth={2.2} />;
  if (kind === "milestone") return <span aria-label="Milestone" className="size-[7px] shrink-0 rotate-45 bg-ink-2" />;
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", late ? "bg-[#D9480F]" : "bg-ink-5")} />;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ month, events, prevHref, nextHref, todayHref }: { month: string; events: CalendarEvent[]; prevHref: string; nextHref: string; todayHref: string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const weeks = days[35].getMonth() === m - 1 ? 6 : 5;
  const todayIso = iso(new Date());
  const title = first.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const [view, setView] = useState<"month" | "agenda">("month");

  return (
    <div className="flex min-h-0 grow flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="w-44 text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        <div className="flex gap-1">
          <Link href={prevHref} aria-label="Previous month" className={buttonClass("secondary", "icon", "max-lg:size-11")}><ChevronLeft aria-hidden className="size-4" /></Link>
          <Link href={todayHref} className={buttonClass("secondary", "md", "max-lg:h-11")}>Today</Link>
          <Link href={nextHref} aria-label="Next month" className={buttonClass("secondary", "icon", "max-lg:size-11")}><ChevronRight aria-hidden className="size-4" /></Link>
        </div>
        <span className="grow" />
        <div className="hidden items-center gap-3.5 text-[12.5px] text-ink-2 lg:flex">
          <span className="flex items-center gap-1.5"><KindMark kind="task" />Tasks</span>
          <span className="flex items-center gap-1.5"><KindMark kind="deadline" />Deadlines</span>
          <span className="flex items-center gap-1.5"><KindMark kind="milestone" />Milestones</span>
          <span className="flex items-center gap-1.5"><KindMark kind="release" />Releases</span>
        </div>
        <div role="group" aria-label="View" className="hidden rounded-[7px] bg-muted p-0.5 lg:flex">
          {(["month", "agenda"] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-[26px] rounded-[5px] px-2.5 text-[12.5px] capitalize", view === v ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(20_20_24/0.08)]" : "text-ink-3")}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month grid: desktop only. Phones always get the agenda. */}
      <div className={cn("min-h-0 grow flex-col overflow-hidden rounded-lg border border-line bg-surface", view === "month" ? "hidden lg:flex" : "hidden")}>
        <div className="grid h-8 grid-cols-7 items-center border-b border-line text-xs font-medium text-ink-4">
          {WEEKDAYS.map((d) => <span key={d} className="px-2.5">{d}</span>)}
        </div>
        <div className="grid grow grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(120px, 1fr))` }}>
          {days.slice(0, weeks * 7).map((d, i) => {
            const key = iso(d);
            const list = byDate.get(key) ?? [];
            const inMonth = d.getMonth() === m - 1;
            const isToday = key === todayIso;
            return (
              <div key={key} className={cn("flex min-h-0 flex-col gap-[3px] overflow-hidden p-1.5", i % 7 !== 6 && "border-r border-line-soft", i < (weeks - 1) * 7 && "border-b border-line-soft", !inMonth && "bg-sunken")}>
                <span className={cn("inline-flex h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-1 text-xs font-medium", isToday ? "bg-accent font-semibold text-white" : inMonth ? "text-ink" : "text-ink-5")}>
                  {d.getDate() === 1 ? `1 ${MONTHS[d.getMonth()]}` : d.getDate()}
                </span>
                {list.slice(0, 3).map((e) => (
                  <Link key={e.id} href={e.href} title={`${e.label} · ${e.sub}`} className={cn("flex h-5 items-center gap-[5px] overflow-hidden rounded px-[5px] text-2xs whitespace-nowrap hover:brightness-95", KIND_STYLE[e.kind], e.late && "font-medium text-warn-ink")}>
                    <KindMark kind={e.kind} late={e.late} />
                    <span className="truncate">{e.label}</span>
                  </Link>
                ))}
                {list.length > 3 ? <span className="px-[5px] text-2xs text-ink-3">+{list.length - 3} more</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <Agenda events={events} className={view === "month" ? "lg:hidden" : undefined} />
    </div>
  );
}

function Agenda({ events, className }: { events: CalendarEvent[]; className?: string }) {
  const { config } = useOrg();
  const todayIso = iso(new Date());
  const upcoming = events.filter((e) => e.date >= todayIso || e.late);
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of upcoming) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  const label = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const diff = Math.round((date.getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
    const name = `${WEEKDAYS[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
    return diff === 0 ? `Today · ${name}` : diff === 1 ? `Tomorrow · ${name}` : name;
  };

  if (groups.size === 0) return <p className={cn("rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-4", className)}>Nothing scheduled for the rest of this month.</p>;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {[...groups.entries()].map(([date, list]) => (
        <section key={date} className="flex flex-col gap-2">
          <h2 className="text-[13.5px] font-semibold text-ink-2">{label(date)}</h2>
          <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
            {list.map((e) => (
              <Link key={e.id} href={e.href} className="flex min-h-14 items-center gap-3 border-t border-line-soft px-3.5 py-2 first:border-t-0 hover:bg-sunken">
                {e.kind === "task" && e.statusId ? <StatusIcon status={config.get(e.statusId)} glyph={config.glyph(e.statusId)} /> : <KindMark kind={e.kind} />}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium max-lg:text-[14.5px]">{e.label}</span>
                  <span className={cn("text-[12.5px]", e.late ? "text-warn-ink" : "text-ink-4")}>{e.late ? "Overdue · " : ""}{e.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
