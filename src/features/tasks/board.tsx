"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CheckSquare, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { openCreate } from "@/components/shell/quick-create";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PriorityIcon, StatusIcon } from "@/components/domain/markers";
import { StatusPicker } from "@/components/domain/status-picker";
import { friendlyError } from "@/lib/errors";
import { dueLabel } from "@/lib/format";
import type { Option } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "./mutations";
import type { TaskRow } from "./queries";

// Drop into the column under the pointer. Overlap alone favours narrow folded
// columns next to the target; keyboard drags have no pointer, so fall back to it.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

/** Filters shared by board and list. Applied to the already-loaded tasks of one project. */
export function useTaskFilters(tasks: TaskRow[]) {
  const params = useSearchParams();
  const [assignee, setAssignee] = useState("any");
  const [priority, setPriority] = useState("any");
  const [label, setLabel] = useState("any");
  // Milestones link here with ?milestone=<id>.
  const [milestone, setMilestone] = useState(() => params.get("milestone") ?? "any");
  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (assignee === "any" || (assignee === "none" ? t.assigneeId === null : t.assigneeId === assignee)) &&
          (priority === "any" || t.priorityId === priority) &&
          (label === "any" || t.labels.includes(label)) &&
          (milestone === "any" || (milestone === "none" ? !t.milestoneId : t.milestoneId === milestone)),
      ),
    [tasks, assignee, priority, label, milestone],
  );
  const labels = useMemo(() => [...new Set(tasks.flatMap((t) => t.labels))].sort(), [tasks]);
  return { filtered, labels, assignee, setAssignee, priority, setPriority, label, setLabel, milestone, setMilestone };
}

export function TaskFilterBar({ f, milestones = [] }: { f: ReturnType<typeof useTaskFilters>; milestones?: { id: string; name: string }[] }) {
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
      {f.labels.length ? (
        <div className="w-36">
          <Select aria-label="Label" value={f.label} onChange={(e) => f.setLabel(e.target.value)}>
            <option value="any">Any label</option>
            {f.labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
      ) : null}
      {milestones.length ? (
        <div className="w-44">
          <Select aria-label="Milestone" value={f.milestone} onChange={(e) => f.setMilestone(e.target.value)}>
            <option value="any">Any milestone</option>
            <option value="none">No milestone</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
      ) : null}
    </div>
  );
}

export function TaskBoard({
  tasks: initial,
  projectId,
  milestones = [],
}: {
  tasks: TaskRow[];
  projectId: string;
  milestones?: { id: string; name: string }[];
}) {
  const { config, can } = useOrg();
  const toast = useToast();
  const [tasks, setTasks] = useState(initial);
  // Take fresh server data after router.refresh() (e.g. a task was created).
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setTasks(initial);
  }
  const f = useTaskFilters(tasks);
  const [dragging, setDragging] = useState<TaskRow | null>(null);
  // Stable across server and client; dnd-kit otherwise numbers its a11y ids globally.
  const dndId = useId();
  const editable = can("tasks.update");

  // Active statuses, plus any archived status that still has tasks on this board.
  const statuses = config
    .allOfKind("task_status")
    .filter((s) => s.isActive || tasks.some((t) => t.statusId === s.id));
  const notStarted = statuses.filter((s) => s.category === "not_started");
  // Backlog-like and completed columns start folded to keep the active work in view.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const folded = (id: string) =>
    !expanded.has(id) && ((notStarted.length > 1 && notStarted[0].id === id) || config.get(id)?.category === "completed");

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const openBlockers = (t: TaskRow) =>
    t.blockedByIds
      .map((id) => byId.get(id))
      .filter((b): b is TaskRow => Boolean(b) && config.get(b!.statusId)?.category !== "completed")
      .map((b) => b.key);

  const setLocal = (id: string, statusId: string) => setTasks((all) => all.map((t) => (t.id === id ? { ...t, statusId } : t)));

  async function move(task: TaskRow, statusId: string, announce = true) {
    if (task.statusId === statusId) return;
    const prev = task.statusId;
    setLocal(task.id, statusId);
    const { error } = await setTaskStatus(task.id, statusId);
    if (error) {
      setLocal(task.id, prev);
      toast({ message: friendlyError(error, `move ${task.key}`) });
      return;
    }
    if (announce) {
      toast({
        message: <>{task.key} moved to {config.get(statusId)?.name}</>,
        action: { label: "Undo", onClick: () => void move({ ...task, statusId }, prev, false) },
      });
    }
  }

  // Mouse: drag after 6px (clicks still open cards). Touch: press-and-hold, so scrolling still works.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(e: DragStartEvent) {
    setDragging(byId.get(String(e.active.id)) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const task = byId.get(String(e.active.id));
    if (task && e.over) void move(task, String(e.over.id));
  }

  return (
    <div className="flex min-h-0 grow flex-col gap-3">
      <div className="px-4 lg:px-8">
        <TaskFilterBar f={f} milestones={milestones} />
      </div>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${byId.get(String(active.id))?.key}.`,
            onDragOver: ({ over }) => (over ? `Over ${config.get(String(over.id))?.name}.` : "Not over a column."),
            onDragEnd: ({ active, over }) => (over ? `Moved ${byId.get(String(active.id))?.key} to ${config.get(String(over.id))?.name}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
          screenReaderInstructions: { draggable: "Press space to pick up a task, arrow keys to move between columns, space to drop, escape to cancel." },
        }}
      >
        <div className="flex min-h-0 grow snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 lg:snap-none lg:px-8" role="list" aria-label="Board columns">
          {statuses.map((s) => {
            const cards = f.filtered.filter((t) => t.statusId === s.id);
            return folded(s.id) ? (
              <FoldedColumn key={s.id} status={s} count={cards.length} onExpand={() => setExpanded((e) => new Set(e).add(s.id))} dropDisabled={!editable} />
            ) : (
              <Column key={s.id} status={s} count={cards.length} projectId={projectId} dropDisabled={!editable}>
                {cards.map((t) => (
                  <Card key={t.id} task={t} blockers={openBlockers(t)} onMove={(id) => move(t, id)} draggable={editable} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? <CardBody task={dragging} blockers={openBlockers(dragging)} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function FoldedColumn({ status, count, onExpand, dropDisabled }: { status: Option; count: number; onExpand: () => void; dropDisabled: boolean }) {
  const { config } = useOrg();
  const { setNodeRef, isOver } = useDroppable({ id: status.id, disabled: dropDisabled });
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="listitem"
      onClick={onExpand}
      aria-label={`${status.name}, ${count} tasks, folded. Expand`}
      className={cn(
        "flex w-10 shrink-0 flex-col items-center gap-2.5 rounded-lg border border-dashed py-3 hover:bg-subtle max-lg:hidden",
        isOver ? "border-accent bg-accent-soft" : "border-line-strong",
      )}
    >
      <StatusIcon status={status} glyph={config.glyph(status.id)} />
      <span className="text-sm font-medium text-ink-2 [writing-mode:vertical-rl]">
        {status.name} <span className="font-normal text-ink-4">{count}</span>
      </span>
    </button>
  );
}

function Column({ status, count, projectId, dropDisabled, children }: { status: Option; count: number; projectId: string; dropDisabled: boolean; children: React.ReactNode }) {
  const { config, can } = useOrg();
  const { setNodeRef, isOver } = useDroppable({ id: status.id, disabled: dropDisabled });
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-label={`${status.name}, ${count} tasks`}
      className={cn(
        "flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col gap-2 rounded-lg p-2 transition-colors lg:w-[220px]",
        isOver ? "bg-accent-soft ring-2 ring-accent-line" : "bg-column",
      )}
    >
      <div className="flex h-7 items-center gap-2 px-1">
        <StatusIcon status={status} glyph={config.glyph(status.id)} />
        <h2 className="grow text-sm font-semibold">
          {status.name} <span className="font-normal text-ink-4">{count}</span>
        </h2>
        {can("tasks.create") ? (
          <button type="button" aria-label={`Add task to ${status.name}`} onClick={() => openCreate(projectId)} className="inline-flex size-6 items-center justify-center rounded-[5px] text-ink-4 hover:bg-muted max-lg:size-9">
            <Plus aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-12 flex-col gap-2 overflow-y-auto">
        {children}
        {count === 0 ? <p className="px-1 py-3 text-center text-xs text-ink-4">{isOver ? "Drop here" : "No tasks"}</p> : null}
      </div>
    </section>
  );
}

function Card({ task, blockers, onMove, draggable }: { task: TaskRow; blockers: string[]; onMove: (statusId: string) => void; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      aria-label={`${task.key} ${task.title}`}
      className={cn("rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus", draggable && "cursor-grab touch-manipulation", isDragging && "opacity-40")}
    >
      <CardBody task={task} blockers={blockers} onMove={onMove} />
    </div>
  );
}

function CardBody({ task: t, blockers, onMove, lifted }: { task: TaskRow; blockers: string[]; onMove?: (statusId: string) => void; lifted?: boolean }) {
  const { config, member } = useOrg();
  const due = dueLabel(t.dueDate);
  return (
    <article className={cn("flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5", lifted && "rotate-[1.5deg] shadow-lift")}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-ink-4">{t.key}</span>
        <Avatar person={member(t.assigneeId)} size="xs" />
      </div>
      <h3 className="text-sm leading-snug font-medium max-lg:text-md">
        {lifted ? t.title : (
          <Link href={`?task=${t.key.toLowerCase()}`} scroll={false} className="hover:text-accent" onPointerDown={(e) => e.stopPropagation()}>
            {t.title}
          </Link>
        )}
      </h3>
      {t.blockedReason ? (
        <p className="rounded bg-danger-soft px-1.5 py-1 text-xs leading-snug text-danger-ink">{t.blockedReason}</p>
      ) : null}
      {blockers.length ? (
        <p className="flex items-center gap-1 text-xs text-warn-ink">
          <Link2 aria-hidden className="size-3" />Blocked by {blockers.join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {onMove ? (
          <span onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <StatusPicker value={t.statusId} onChange={onMove} label={t.key} subtitle={t.title} className="size-6 max-lg:size-9" />
          </span>
        ) : (
          <StatusIcon status={config.get(t.statusId)} glyph={config.glyph(t.statusId)} />
        )}
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
}
