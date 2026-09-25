"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useOrg } from "@/components/shell/org-provider";
import { AvatarStack } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Progress } from "@/components/ui/progress";
import { PriorityIcon, StatusPill } from "@/components/domain/markers";
import { daysFromToday, formatDate, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client, Project } from "@/lib/types";

export function ProjectHeader({ project }: { project: Project & { client: Client | null } }) {
  const { config, member, can, href } = useOrg();
  const toast = useToast();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const pct = percent(project.tasksDone, project.tasksTotal);
  const left = project.dueDate ? daysFromToday(project.dueDate) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-subtle text-lg font-semibold text-ink-2">
          {project.name[0]}
        </span>
        <div className="flex min-w-0 grow flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{project.name}</h1>
            <span className="rounded border border-line px-[5px] font-mono text-2xs text-ink-3">{project.key}</span>
            <StatusPill option={config.get(project.statusId)} />
          </div>
          <p className="text-sm text-ink-3 max-lg:line-clamp-2">{project.description}</p>
        </div>
        {can("projects.update") ? (
          <div className="flex shrink-0 gap-2">
            <Menu>
              <MenuTrigger aria-label="More actions" className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface hover:bg-sunken max-lg:size-11">
                <MoreHorizontal aria-hidden className="size-4 text-ink-2" />
              </MenuTrigger>
              <MenuContent align="end" label="Project actions">
                <MenuItem onSelect={() => { navigator.clipboard?.writeText(window.location.href); toast({ message: "Link copied" }); }}>Copy link</MenuItem>
                {can("projects.delete") ? (
                  <>
                    <MenuSeparator />
                    <MenuItem destructive onSelect={() => setArchiveOpen(true)}>Archive project…</MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
            <ConfirmDialog
              open={archiveOpen}
              onOpenChange={setArchiveOpen}
              title={`Archive “${project.name}”?`}
              actionLabel="Archive project"
              confirmText={project.key}
              onConfirm={() => toast({ message: "Archive is not connected yet · sample data" })}
            >
              <p>Its {project.tasksTotal} tasks, issues and documents become read-only and leave the active lists. Nothing is deleted, and you can restore it later.</p>
            </ConfirmDialog>
          </div>
        ) : null}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Client</dt>
          <dd>{project.client ? <Link href={href(`/clients?client=${project.client.id}`)} className="text-accent hover:text-accent-hover">{project.client.name}</Link> : "Internal"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Type</dt>
          <dd>{config.get(project.typeId)?.name}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Priority</dt>
          <dd className="flex items-center gap-1.5"><PriorityIcon priority={config.get(project.priorityId)} />{config.get(project.priorityId)?.name}</dd>
        </div>
        <div className="flex flex-col gap-1 max-lg:hidden">
          <dt className="text-xs text-ink-4">Timeline</dt>
          <dd>
            {project.startDate ? formatDate(project.startDate) : "—"} → {project.dueDate ? formatDate(project.dueDate, { year: true }) : "no deadline"}
            {left !== null ? <span className={cn(left < 14 ? "text-late" : "text-ink-4")}> · {left >= 0 ? `${left} days left` : `${-left} days late`}</span> : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-ink-4">Progress</dt>
          <dd className="flex items-center gap-2">
            <Progress value={pct} className="w-24" />
            {pct}% <span className="text-ink-4 max-lg:hidden">· {project.tasksDone} of {project.tasksTotal} tasks</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1 max-lg:hidden">
          <dt className="text-xs text-ink-4">Members</dt>
          <dd><AvatarStack people={project.memberIds.map((id) => member(id)!).filter(Boolean)} /></dd>
        </div>
      </dl>
    </div>
  );
}

const TABS = [
  { path: "", label: "Board" },
  { path: "/list", label: "List" },
  { path: "/issues", label: "Issues" },
  { path: "/releases", label: "Releases" },
  { path: "/activity", label: "Activity" },
];

export function ProjectTabs({ base }: { base: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project sections" className="-mx-4 mt-4 flex gap-5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {TABS.map((t) => {
        const target = `${base}${t.path}`;
        const active = pathname === target;
        return (
          <Link
            key={t.path}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 pt-2 pb-2.5 text-base max-lg:pb-3 max-lg:text-md",
              active ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
