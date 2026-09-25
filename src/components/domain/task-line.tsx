"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrg } from "@/components/shell/org-provider";
import { taskHref } from "@/features/tasks/drawer";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badge";
import { dueLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/features/tasks/mutations";
import { PriorityIcon } from "./markers";
import { StatusPicker, useOptimisticStatus } from "./status-picker";

export interface TaskLineData {
  id: string;
  key: string;
  title: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  dueDate: string | null;
  projectName: string;
}

/**
 * One task in a list. Desktop: a dense grid row. Phone: a 60px row with a
 * 52px status target on the left, so status changes are one thumb tap.
 */
export function TaskLine({ task, showProject = true, showAssignee = false }: { task: TaskLineData; showProject?: boolean; showAssignee?: boolean }) {
  const { config, member, org } = useOrg();
  const pathname = usePathname();
  const [statusId, setStatus] = useOptimisticStatus(task.statusId, task.key, (s) => setTaskStatus(task.id, s));
  // Inside the task's own project, open the drawer in place; elsewhere, go to its board.
  const projectBase = `/${org.slug}/projects/${task.key.split("-")[0].toLowerCase()}`;
  const openHref = pathname.startsWith(projectBase) ? `${pathname}?task=${task.key.toLowerCase()}` : taskHref(org.slug, task.key);
  const due = dueLabel(task.dueDate);
  const done = config.get(statusId)?.category === "completed";

  return (
    <div className="flex items-center border-t border-line-soft first:border-t-0 max-lg:min-h-[60px] lg:h-[42px] lg:gap-3 lg:px-4">
      <StatusPicker
        value={statusId}
        onChange={setStatus}
        label={task.key}
        subtitle={task.title}
        className="max-lg:h-[60px] max-lg:w-[52px] lg:size-6"
        iconSize={14}
      />
      <span className="hidden w-16 shrink-0 font-mono text-xs text-ink-4 lg:block">{task.key}</span>
      <Link
        href={openHref}
        scroll={false}
        className="flex min-w-0 grow flex-col gap-0.5 self-stretch py-2.5 pr-3.5 hover:text-accent lg:flex-row lg:items-center lg:gap-3 lg:py-0 lg:pr-0"
      >
        <span className={cn("truncate max-lg:text-[14.5px] max-lg:font-medium", done && "text-ink-4 line-through decoration-ink-6")}>{task.title}</span>
        <span className="text-[12.5px] text-ink-4 lg:hidden">
          {task.key}
          {showProject ? ` · ${task.projectName}` : ""} · <span className={cn(due.late && "font-medium text-late")}>{due.text}</span>
        </span>
      </Link>
      {showProject ? <Tag className="hidden lg:inline-flex">{task.projectName}</Tag> : null}
      <PriorityIcon priority={config.get(task.priorityId)} className="hidden lg:block" />
      <span className={cn("hidden w-[76px] shrink-0 text-right text-[12.5px] lg:block", due.late ? "font-medium text-late" : "text-ink-3")}>{due.text}</span>
      {showAssignee ? <Avatar person={member(task.assigneeId)} className="hidden lg:inline-flex" /> : null}
    </div>
  );
}
