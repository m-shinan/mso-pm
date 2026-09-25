"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Tag as TagIcon } from "lucide-react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/domain/markers";
import { TaskLine } from "@/components/domain/task-line";
import { daysFromToday, formatDate, percent } from "@/lib/format";
import { tone } from "@/lib/options";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/features/tasks/queries";
import type { ReleaseRow } from "./queries";

export function ReleasesView({ releases, selected, tasks }: { releases: ReleaseRow[]; selected: ReleaseRow | null; tasks: TaskRow[] }) {
  const { config, can, org } = useOrg();
  const pathname = usePathname();
  if (releases.length === 0) {
    return (
      <EmptyState icon={TagIcon} title="No releases yet">
        Group tasks and fixes into versions like v1.0.0 to track what ships when. {org.name} has none so far.
      </EmptyState>
    );
  }
  const groups = [
    { title: "Upcoming", items: releases.filter((r) => !r.released) },
    { title: "Released", items: releases.filter((r) => r.released) },
  ].filter((g) => g.items.length);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <div className={cn("flex flex-col gap-3", selected && "max-lg:hidden")}>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium text-ink-4">{g.title}</h2>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {g.items.map((r) => {
                const on = selected?.id === r.id;
                const pct = percent(r.tasksDone, r.tasksTotal);
                return (
                  <Link
                    key={r.id}
                    href={`${pathname}?release=${r.id}`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={cn("grid grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft px-3.5 py-2.5 first:border-t-0", on ? "bg-[#F3F6FD]" : "hover:bg-sunken")}
                  >
                    <span className="font-mono text-sm font-medium">{r.version}</span>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm"><span className="font-medium">{r.projectName}</span> <span className="text-ink-4">· {r.name}</span></span>
                      <span className="flex items-center gap-2">
                        <Progress value={r.released ? 100 : pct} tone={r.released ? "done" : "accent"} className="w-[120px]" />
                        <span className="text-xs text-ink-4">{r.tasksTotal ? `${r.tasksDone}/${r.tasksTotal}` : ""}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className="rounded px-[7px] py-px text-2xs font-medium" style={tone(config.get(r.statusId)?.color ?? "#8A8A92")}>{config.get(r.statusId)?.name}</span>
                      <span className="text-xs text-ink-4">{r.releaseDate ? formatDate(r.releaseDate) : "No date"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <section aria-label={`Release ${selected.version}`} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-col gap-3.5 border-b border-line-soft px-5 pt-4 pb-4 lg:px-6 lg:pt-5">
            <Link href={pathname} className="-ml-1 flex items-center gap-1 text-sm text-ink-3 lg:hidden"><ChevronLeft aria-hidden className="size-4" />All releases</Link>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-medium">{selected.version}</span>
              <span className="text-[16px] font-semibold">{selected.name}</span>
              <StatusPill option={config.get(selected.statusId)} />
              <span className="grow" />
              {can("releases.manage") && !selected.released ? (
                <Button disabled={selected.openIssues > 0} title={selected.openIssues ? "Resolve blocking issues first" : undefined}>Mark released</Button>
              ) : null}
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div className="flex flex-col gap-0.5"><dt className="text-xs text-ink-4">Project</dt><dd>{selected.projectName}</dd></div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-ink-4">{selected.released ? "Released" : "Target date"}</dt>
                <dd>{selected.releaseDate ? formatDate(selected.releaseDate, { year: true }) : "Not set"}{selected.releaseDate && !selected.released ? ` · ${daysFromToday(selected.releaseDate)} days` : ""}</dd>
              </div>
              <div className="flex flex-col gap-0.5"><dt className="text-xs text-ink-4">Tasks</dt><dd>{selected.tasksDone} of {selected.tasksTotal} done</dd></div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-ink-4">Blocking issues</dt>
                <dd className={cn(selected.openIssues && "font-medium text-danger-ink")}>{selected.openIssues ? `${selected.openIssues} open` : "None"}</dd>
              </div>
            </dl>
          </div>
          <div className="grid lg:grid-cols-2">
            <div className="border-line-soft lg:border-r">
              <h3 className="border-b border-line-soft px-5 py-2.5 text-sm font-semibold">In this release <span className="font-normal text-ink-4">{tasks.length}</span></h3>
              {tasks.length ? tasks.map((t) => <TaskLine key={t.id} task={t} showProject={false} />) : <p className="px-5 py-4 text-sm text-ink-4">No tasks linked yet.</p>}
            </div>
            <div className="max-lg:border-t max-lg:border-line-soft">
              <h3 className="border-b border-line-soft px-5 py-2.5 text-sm font-semibold">Changelog</h3>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-normal">
                {(["added", "changed", "fixed"] as const).map((k) =>
                  selected.changelog[k].length ? (
                    <div key={k} className="flex flex-col gap-1">
                      <span className={cn("text-xs font-semibold capitalize", k === "added" ? "text-[#2F6B45]" : k === "changed" ? "text-accent-hover" : "text-warn-ink")}>{k}</span>
                      <ul className="list-disc pl-[18px] text-[#2A2A30]">{selected.changelog[k].map((line) => <li key={line}>{line}</li>)}</ul>
                    </div>
                  ) : null,
                )}
                {!selected.changelog.added.length && !selected.changelog.changed.length && !selected.changelog.fixed.length ? (
                  <p className="text-ink-4">Empty. It fills from completed tasks when the release is marked released.</p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <p className="hidden rounded-lg border border-dashed border-line-strong px-5 py-10 text-center text-sm text-ink-4 lg:block">Select a release to see its tasks and changelog.</p>
      )}
    </div>
  );
}
