"use client";

import { CheckSquare, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { openCreate } from "@/components/shell/quick-create";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PriorityIcon, StatusIcon } from "@/components/domain/markers";
import { StatusPicker } from "@/components/domain/status-picker";
import { dueLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRow } from "./queries";

/** Filters shared by board and list. Applied to the already-loaded page of tasks. */
export function useTaskFilters(tasks: TaskRow[]) {
  const [assignee, setAssignee] = useState("any");
  const [priority, setPriority] = useState("any");
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (assignee === "any" || (assignee === "none" ? t.assigneeId === null : t.assigneeId === assignee)) &&
          (priority === "any" || t.priorityId === priority),
      ),
    [tasks, assignee, priority],
  );
  return { filtered, assignee, setAssignee, priority, setPriority };
}

export function TaskFilterBar({ f }: { f: ReturnType<typeof useTaskFilters> }) {
  const { members, config } = useOrg();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40">
        <Select aria-label="Assignee" value={f.assignee} onChange={(e) => f.setAssignee(e.target.value)}>
          <option value="any">Any assignee</option>
          <option value="none">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div className="w-36">
        <Select aria-label="Priority" value={f.priority} onChange={(e) => f.setPriority(e.target.value)}>
          <option value="any">Any priority</option>
          {config.ofKind("task_priority").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks: initial, projectId }: { tasks: TaskRow[]; projectId: string }) {
  const { config, member, can } = useOrg();
  const toast = useToast();
  const [tasks, setTasks] = useState(initial);
  const f = useTaskFilters(tasks);
  const statuses = config.ofKind("task_status");
  const notStarted = statuses.filter((s) => s.category === "not_started");
  // Backlog-like and completed columns start folded to keep the active work in view.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const folded = (id: string) =>
    !expanded.has(id) && ((notStarted.length > 1 && notStarted[0].id === id) || config.get(id)?.category === "completed");

  function move(task: TaskRow, statusId: string) {
    if (task.statusId === statusId) return;
    const prev = task.statusId;
    setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, statusId } : t)));
    toast({
      message: <>{task.key} moved to {config.get(statusId)?.name}</>,
      action: { label: "Undo", onClick: () => setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, statusId: prev } : t))) },
    });
  }

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <div className="px-4 lg:px-8">
        <TaskFilterBar f={f} />
      </div>
      <div className="flex min-h-0 grow snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 lg:snap-none lg:px-8" role="list" aria-label="Board columns">
        {statuses.map((s) => {
          const cards = f.filtered.filter((t) => t.statusId === s.id);
          if (folded(s.id)) {
            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                onClick={() => setExpanded((e) => new Set(e).add(s.id))}
                aria-label={`${s.name}, ${cards.length} tasks, folded. Expand`}
                className="flex w-10 shrink-0 flex-col items-center gap-2.5 rounded-lg border border-dashed border-line-strong py-3 hover:bg-subtle max-lg:hidden"
              >
                <StatusIcon status={s} glyph={config.glyph(s.id)} />
                <span className="text-sm font-medium text-ink-2 [writing-mode:vertical-rl]">
                  {s.name} <span className="font-normal text-ink-4">{cards.length}</span>
                </span>
              </button>
            );
          }
          return (
            <section
              key={s.id}
              role="listitem"
              aria-label={`${s.name}, ${cards.length} tasks`}
              className="flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col gap-2 rounded-lg bg-[#EFEEEA] p-2 lg:w-[220px]"
            >
              <div className="flex h-7 items-center gap-2 px-1">
                <StatusIcon status={s} glyph={config.glyph(s.id)} />
                <h2 className="grow text-sm font-semibold">
                  {s.name} <span className="font-normal text-ink-4">{cards.length}</span>
                </h2>
                {can("tasks.create") ? (
                  <button type="button" aria-label={`Add task to ${s.name}`} onClick={() => openCreate(projectId)} className="inline-flex size-6 items-center justify-center rounded-[5px] text-ink-4 hover:bg-muted max-lg:size-9">
                    <Plus aria-hidden className="size-3.5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
                {cards.map((t) => {
                  const due = dueLabel(t.dueDate);
                  return (
                    <article key={t.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-2xs text-ink-4">{t.key}</span>
                        <Avatar person={member(t.assigneeId)} size="xs" />
                      </div>
                      <h3 className="text-sm leading-snug font-medium max-lg:text-md">{t.title}</h3>
                      {t.blockedReason ? (
                        <p className="rounded bg-danger-soft px-1.5 py-1 text-xs leading-snug text-danger-ink">{t.blockedReason}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPicker value={t.statusId} onChange={(id) => move(t, id)} label={t.key} subtitle={t.title} className="size-6 max-lg:size-9" />
                        <PriorityIcon priority={config.get(t.priorityId)} />
                        {t.labels.map((l) => <Label key={l}>{l}</Label>)}
                        {t.checklist ? (
                          <span className="flex items-center gap-1 text-2xs text-ink-3">
                            <CheckSquare aria-hidden className="size-3 text-ink-4" />
                            {t.checklist.done}/{t.checklist.total}
                          </span>
                        ) : null}
                        <span className="grow" />
                        <span className={cn("text-2xs", due.late ? "font-medium text-late" : "text-ink-4")}>{due.text}</span>
                      </div>
                    </article>
                  );
                })}
                {cards.length === 0 ? <p className="px-1 py-3 text-center text-xs text-ink-4">No tasks</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
