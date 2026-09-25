"use client";

import Link from "next/link";
import { Bug, CircleCheck, Flag, FolderPlus } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Section, TableHead } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/states";
import { StatusDot, StatusIcon } from "@/components/domain/markers";
import { TaskLine, type TaskLineData } from "@/components/domain/task-line";
import { daysFromToday, formatDate, MONTHS, parseISODate, percent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { taskHref } from "@/features/tasks/drawer";
import type { DashboardData } from "./queries";

const TONES = {
  danger: "bg-danger-soft text-danger-ink",
  warn: "bg-warn-soft text-warn-ink",
  neutral: "bg-subtle text-ink-2",
};

export function StatStrip({ stats }: { stats: DashboardData["stats"] }) {
  const { href } = useOrg();
  const items = [
    { label: "Active projects", value: stats.activeProjects, sub: null, dot: "#2D55C8", path: "/projects" },
    { label: "Due today", value: stats.dueToday, sub: null, dot: "var(--color-ink-2)", path: "/my-tasks" },
    { label: "Overdue", value: stats.overdue, sub: stats.overdue ? `oldest ${stats.oldestOverdueDays} days` : null, dot: "#D9480F", path: "/my-tasks", subTone: "text-warn-ink" },
    { label: "Open issues", value: stats.openIssues, sub: stats.criticalIssues ? `${stats.criticalIssues} critical` : null, dot: "#CC3A21", path: "/issues", subTone: "text-danger-ink" },
    { label: "Blocked", value: stats.blocked, sub: null, dot: "#CC3A21", path: "/my-tasks" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-5 lg:gap-px lg:overflow-hidden lg:rounded-lg lg:border lg:border-line lg:bg-line">
      {items.map((s, i) => (
        <Link
          key={s.label}
          href={`${href(s.path)}`}
          className={cn(
            "flex flex-col gap-1.5 bg-surface px-3 py-2.5 max-lg:rounded-[10px] max-lg:border max-lg:border-line lg:px-4 lg:py-3.5 lg:hover:bg-sunken",
            // Phones show the three that matter most.
            (i === 0 || i === 4) && "max-lg:hidden",
          )}
        >
          <span className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
            <span aria-hidden className="size-1.5 rounded-full" style={{ background: s.dot }} />
            {s.label}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[22px] leading-none font-semibold tabular max-lg:text-xl">{s.value}</span>
            {s.sub ? <span className={cn("text-xs max-lg:hidden", s.subTone ?? "text-ink-4")}>{s.sub}</span> : null}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function AttentionList({ items }: { items: DashboardData["attention"] }) {
  const { config, member, org, href } = useOrg();
  return (
    <Section title="Needs attention" count={items.length}>
      {items.length === 0 ? (
        <p className="border-t border-line-soft px-4 py-6 text-center text-sm text-ink-4">Nothing overdue, blocked or critical.</p>
      ) : (
        items.map((r) => (
          <Link
            key={r.id + r.reason}
            href={
              r.kind === "task" ? taskHref(org.slug, r.key)
              : r.kind === "issue" ? href(`/issues?issue=${r.key.toLowerCase()}`)
              : href(`/projects/${r.key.toLowerCase()}`)
            }
            className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-4 py-2.5 hover:bg-sunken lg:grid-cols-[18px_minmax(0,1fr)_auto_22px] lg:py-0 lg:h-[52px]"
          >
            <span className="flex">
              {r.kind === "task" && r.statusId ? <StatusIcon status={config.get(r.statusId)} glyph={config.glyph(r.statusId)} /> : null}
              {r.kind === "issue" ? <Bug aria-label="Issue" className="size-4 text-danger-ink" strokeWidth={1.9} /> : null}
              {r.kind === "project" ? <Flag aria-label="Project deadline" className="size-4 text-ink-2" strokeWidth={1.8} /> : null}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium max-lg:text-[14.5px]">{r.title}</span>
              <span className="text-xs text-ink-4">
                <span className="font-mono text-2xs">{r.key}</span> · {r.project}
              </span>
            </span>
            <span className={cn("rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[r.tone])}>{r.reason}</span>
            <span className="hidden lg:flex">{r.personId ? <Avatar person={member(r.personId)} /> : null}</span>
          </Link>
        ))
      )}
    </Section>
  );
}

type WorkTab = "today" | "upcoming" | "blocked";

export function MyWork({ work }: { work: DashboardData["myWork"] }) {
  const { href } = useOrg();
  const [tab, setTab] = useState<WorkTab>("today");
  const tabs: { id: WorkTab; label: string; count: number }[] = [
    { id: "today", label: "Today", count: work.today.length },
    { id: "upcoming", label: "Upcoming", count: work.upcoming.length },
    { id: "blocked", label: "Blocked", count: work.blocked.length },
  ];
  const rows: TaskLineData[] = work[tab];
  return (
    <Section
      title="My work"
      action={
        <div role="tablist" aria-label="My work" className="flex gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("h-7 rounded-[5px] px-2.5 text-sm whitespace-nowrap max-lg:h-9", tab === t.id ? "bg-subtle font-medium text-ink" : "text-ink-3 hover:bg-subtle")}
            >
              {t.label} <span className="font-normal text-ink-4 tabular">{t.count}</span>
            </button>
          ))}
        </div>
      }
    >
      <div role="tabpanel" className="border-t border-line-soft">
        {rows.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title={tab === "blocked" ? "Nothing blocked" : "No tasks here"}
            className="m-4"
            action={<Link href={href("/my-tasks")} className={buttonClass()}>All my tasks</Link>}
          >
            {tab === "today" ? "Tasks assigned to you that are overdue or due today show up here." : undefined}
          </EmptyState>
        ) : (
          rows.map((t) => <TaskLine key={t.id} task={t} />)
        )}
      </div>
    </Section>
  );
}

export function Deadlines({ items }: { items: DashboardData["deadlines"] }) {
  const { href } = useOrg();
  return (
    <Section title="Upcoming deadlines" action={<Link href={href("/calendar")} className="text-sm text-accent hover:text-accent-hover">Calendar</Link>}>
      {items.length === 0 ? (
        <p className="border-t border-line-soft px-4 py-6 text-center text-sm text-ink-4">No upcoming deadlines.</p>
      ) : (
        items.map((d) => {
          const date = parseISODate(d.date);
          return (
            <div key={d.id} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5">
              <span className="flex w-10 shrink-0 flex-col items-center rounded-md border border-line py-1 leading-tight">
                <span className="text-[10.5px] font-medium text-ink-4 uppercase">{MONTHS[date.getMonth()]}</span>
                <span className="text-lg font-semibold">{date.getDate()}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{d.title}</span>
                <span className="text-xs text-ink-4">{d.kind} · {daysFromToday(d.date)} days</span>
              </span>
            </div>
          );
        })
      )}
    </Section>
  );
}

export function ProjectsTable({ projects }: { projects: DashboardData["projects"] }) {
  const { config, member, href } = useOrg();
  const cols = "lg:grid-cols-[minmax(0,2.2fr)_120px_130px_170px_100px_96px_96px]";
  return (
    <Section title="Active projects" count={projects.length} action={<Link href={href("/projects")} className="text-sm text-accent hover:text-accent-hover">All projects</Link>}>
      {projects.length === 0 ? (
        <EmptyState icon={FolderPlus} title="No projects yet" className="m-4 mt-0">
          Create a project to start tracking tasks, issues and releases.
        </EmptyState>
      ) : (
        <>
          <TableHead className={cols}>
            <span>Project</span><span>Type</span><span>Status</span><span>Progress</span><span>Deadline</span><span>Team</span><span className="text-right">Updated</span>
          </TableHead>
          {projects.map((p) => {
            const pct = percent(p.tasksDone, p.tasksTotal);
            const soon = p.dueDate ? daysFromToday(p.dueDate) <= 14 : false;
            return (
              <Link
                key={p.id}
                href={href(`/projects/${p.key.toLowerCase()}`)}
                className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3 hover:bg-sunken lg:h-[52px] lg:py-0", cols)}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-subtle text-xs font-semibold text-ink-2">{p.name[0]}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-xs text-ink-4">{config.get(p.typeId)?.name}</span>
                  </span>
                </span>
                <span className="hidden lg:block"><Tag>{config.get(p.typeId)?.name}</Tag></span>
                <StatusDot option={config.get(p.statusId)} className="max-lg:hidden" />
                <span className="flex items-center gap-2.5 max-lg:justify-end">
                  <Progress value={pct} className="w-[100px] max-lg:w-16" />
                  <span className="text-[12.5px] text-ink-2 tabular">{pct}%</span>
                </span>
                <span className={cn("text-sm max-lg:hidden", soon ? "text-late" : "text-ink")}>{p.dueDate ? formatDate(p.dueDate) : "—"}</span>
                <span className="hidden lg:flex"><AvatarStack people={p.memberIds.map((id) => member(id)!).filter(Boolean)} max={3} /></span>
                <span suppressHydrationWarning className="hidden text-right text-[12.5px] text-ink-4 lg:block">{timeAgo(p.updatedAt)}</span>
              </Link>
            );
          })}
        </>
      )}
    </Section>
  );
}
