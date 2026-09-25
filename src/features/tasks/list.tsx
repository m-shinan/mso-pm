"use client";

import { useOrg } from "@/components/shell/org-provider";
import { Section } from "@/components/ui/section";
import { TaskLine } from "@/components/domain/task-line";
import { TaskFilterBar, useTaskFilters } from "./board";
import type { TaskRow } from "./queries";

/** Tasks grouped by status — the fast-scan view of a project. */
export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const { config } = useOrg();
  const f = useTaskFilters(tasks);
  const groups = config
    .ofKind("task_status")
    .map((s) => ({ status: s, tasks: f.filtered.filter((t) => t.statusId === s.id) }))
    .filter((g) => g.tasks.length);

  return (
    <div className="flex flex-col gap-4">
      <TaskFilterBar f={f} />
      {groups.length === 0 ? <p className="py-8 text-center text-sm text-ink-4">No tasks match these filters.</p> : null}
      {groups.map((g) => (
        <Section key={g.status.id} id={`status-${g.status.id}`} title={g.status.name} count={g.tasks.length}>
          <div className="border-t border-line-soft">
            {g.tasks.map((t) => <TaskLine key={t.id} task={t} showProject={false} showAssignee />)}
          </div>
        </Section>
      ))}
    </div>
  );
}
