"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Tag } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { TableHead } from "@/components/ui/section";
import { StatusDot } from "@/components/domain/markers";
import { daysFromToday, formatDate, percent, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "./queries";

const COLS = "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_120px_130px_160px_96px_96px]";

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const { config, href } = useOrg();
  const [status, setStatus] = useState("open");
  const [type, setType] = useState("all");

  const shown = useMemo(
    () =>
      projects.filter((p) => {
        const cat = config.get(p.statusId)?.category;
        if (status === "open" && cat === "completed") return false;
        if (status !== "open" && status !== "all" && p.statusId !== status) return false;
        return type === "all" || p.typeId === type;
      }),
    [projects, status, type, config],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <div className="w-44">
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Not completed</option>
            <option value="all">All statuses</option>
            {config.ofKind("project_status").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {config.ofKind("project_type").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <TableHead className={cn(COLS, "border-t-0")}>
          <span>Project</span><span>Client</span><span>Type</span><span>Status</span><span>Progress</span><span>Deadline</span><span className="text-right">Updated</span>
        </TableHead>
        {shown.length === 0 ? <p className="border-t border-line-soft px-4 py-8 text-center text-sm text-ink-4">No projects match these filters.</p> : null}
        {shown.map((p) => {
          const pct = percent(p.tasksDone, p.tasksTotal);
          const late = p.dueDate ? daysFromToday(p.dueDate) <= 14 : false;
          return (
            <Link
              key={p.id}
              href={href(`/projects/${p.key.toLowerCase()}`)}
              className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-line-soft px-4 py-3 first-of-type:border-t-0 hover:bg-sunken lg:h-14 lg:py-0", COLS)}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-subtle text-sm font-semibold text-ink-2">{p.name[0]}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate font-medium max-lg:text-[14.5px]">
                    {p.name}
                    <span className="font-mono text-2xs font-normal text-ink-4">{p.key}</span>
                  </span>
                  <span className="truncate text-xs text-ink-4 lg:hidden">{p.clientName ?? "Internal"} · {config.get(p.typeId)?.name}</span>
                </span>
              </span>
              <span className="hidden truncate text-sm text-ink-2 lg:block">{p.clientName ?? "—"}</span>
              <span className="hidden lg:block"><Tag>{config.get(p.typeId)?.name}</Tag></span>
              <StatusDot option={config.get(p.statusId)} className="max-lg:text-xs max-lg:justify-self-end" />
              <span className="col-span-2 flex items-center gap-2.5 lg:col-span-1">
                <Progress value={pct} className="w-full max-w-[100px] max-lg:max-w-none max-lg:grow" />
                <span className="text-[12.5px] text-ink-2 tabular">{pct}%</span>
                <span className="text-xs text-ink-4 max-lg:hidden">{p.tasksDone}/{p.tasksTotal}</span>
              </span>
              <span className={cn("hidden text-sm lg:block", late ? "text-late" : "text-ink")}>{p.dueDate ? formatDate(p.dueDate) : "—"}</span>
              <span suppressHydrationWarning className="hidden text-right text-[12.5px] text-ink-4 lg:block">{timeAgo(p.updatedAt)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
