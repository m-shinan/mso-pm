"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Link2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Comments } from "@/components/domain/comments";
import { StatusPicker, useOptimisticStatus } from "@/components/domain/status-picker";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommentRow } from "@/features/issues/queries";
import { addChecklistItem, deleteTask, setTaskStatus, toggleChecklistItem, updateTask } from "./mutations";
import type { TaskDetail } from "./queries";

/** Href that opens a task's drawer on its project board, from anywhere. */
export function taskHref(orgSlug: string, taskKey: string) {
  return `/${orgSlug}/projects/${taskKey.split("-")[0].toLowerCase()}?task=${taskKey.toLowerCase()}`;
}

export function TaskDrawer({ task, comments }: { task: TaskDetail | null; comments: CommentRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!task) return null;
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("task");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DrawerContent
        label={`Task ${task.key}`}
        header={
          <>
            <span className="font-mono text-xs text-ink-3">{task.key}</span>
            <span aria-hidden className="text-ink-6">·</span>
            <span className="text-[12.5px] text-ink-3">{task.project.name}</span>
            <span className="grow" />
            <button
              type="button"
              aria-label="Copy link"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="inline-flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-subtle lg:size-[30px]"
            >
              <Link2 aria-hidden className="size-[15px]" />
            </button>
          </>
        }
      >
        <TaskBody key={task.id + task.updated_at} task={task} comments={comments} onDeleted={close} />
      </DrawerContent>
    </Dialog>
  );
}

function TaskBody({ task, comments, onDeleted }: { task: TaskDetail; comments: CommentRow[]; onDeleted: () => void }) {
  const { org, config, members, member, can, currentUserId } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const editable = can("tasks.update");
  const [statusId, setStatus] = useOptimisticStatus(task.status_id, task.key, async (s) => {
    const res = await setTaskStatus(task.id, s);
    if (!res.error) router.refresh();
    return res;
  });
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [checklist, setChecklist] = useState(task.checklist);
  const [newItem, setNewItem] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const reporter = member(task.reporter_id);

  async function save(patch: Parameters<typeof updateTask>[1], what: string) {
    const { error } = await updateTask(task.id, patch);
    if (error) return toast({ message: friendlyError(error, `save the ${what}`) });
    router.refresh();
  }

  async function toggle(id: string, done: boolean) {
    setChecklist((c) => c.map((i) => (i.id === id ? { ...i, done } : i)));
    const { error } = await toggleChecklistItem(id, done);
    if (error) {
      setChecklist((c) => c.map((i) => (i.id === id ? { ...i, done: !done } : i)));
      toast({ message: friendlyError(error, "update the checklist") });
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    const body = newItem.trim();
    if (!body) return;
    const { data, error } = await addChecklistItem({
      organizationId: org.id,
      projectId: task.project_id,
      taskId: task.id,
      body,
      sortOrder: (checklist[checklist.length - 1]?.sort_order ?? 0) + 1,
    });
    if (error || !data) return toast({ message: friendlyError(error, "add the item") });
    setChecklist((c) => [...c, data]);
    setNewItem("");
  }

  async function remove() {
    const { error } = await deleteTask(task.id);
    if (error) return toast({ message: friendlyError(error, "delete the task") });
    toast({ message: `${task.key} deleted` });
    onDeleted();
    router.refresh();
  }

  const done = checklist.filter((i) => i.done).length;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {editable ? (
        <Textarea
          aria-label="Title"
          value={title}
          maxLength={200}
          rows={1}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== task.title && save({ title: title.trim() }, "title")}
          className="min-h-0 resize-none border-transparent px-0 text-xl leading-snug font-semibold hover:border-line focus:px-2.5"
        />
      ) : (
        <h2 className="text-xl leading-snug font-semibold">{task.title}</h2>
      )}

      <dl className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm">
        <dt className="text-ink-4">Status</dt>
        <dd className="flex items-center gap-1.5">
          <StatusPicker value={statusId} onChange={setStatus} label={task.key} subtitle={task.title} className="size-7 max-lg:size-10" />
          {config.get(statusId)?.name}
        </dd>
        <dt className="text-ink-4">Assignee</dt>
        <dd>
          {editable ? (
            <Select aria-label="Assignee" defaultValue={task.assignee_id ?? ""} onChange={(e) => save({ assignee_id: e.target.value || null }, "assignee")} className="h-8 max-lg:h-10">
              <option value="">Unassigned</option>
              {members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          ) : member(task.assignee_id)?.name ?? "Unassigned"}
        </dd>
        <dt className="text-ink-4">Priority</dt>
        <dd>
          {editable ? (
            <Select aria-label="Priority" defaultValue={task.priority_id} onChange={(e) => save({ priority_id: e.target.value }, "priority")} className="h-8 max-lg:h-10">
              {config.allOfKind("task_priority").filter((o) => o.isActive || o.id === task.priority_id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          ) : config.get(task.priority_id)?.name}
        </dd>
        <dt className="text-ink-4">Due date</dt>
        <dd>
          {editable ? (
            <Input aria-label="Due date" type="date" defaultValue={task.due_date ?? ""} onChange={(e) => save({ due_date: e.target.value || null }, "due date")} className="h-8 max-lg:h-10" />
          ) : task.due_date ?? "None"}
        </dd>
        {config.get(statusId)?.category === "blocked" || task.blocked_reason ? (
          <>
            <dt className="text-ink-4">Blocked by</dt>
            <dd>
              {editable ? (
                <Input
                  aria-label="Blocked by"
                  defaultValue={task.blocked_reason ?? ""}
                  maxLength={300}
                  placeholder="e.g. Waiting on client API keys"
                  onBlur={(e) => e.target.value !== (task.blocked_reason ?? "") && save({ blocked_reason: e.target.value.trim() || null }, "reason")}
                  className="h-8 max-lg:h-10"
                />
              ) : task.blocked_reason}
            </dd>
          </>
        ) : null}
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Description</h3>
        {editable ? (
          <Textarea
            aria-label="Description"
            value={description}
            maxLength={20000}
            rows={4}
            placeholder="Add details, acceptance criteria, links…"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== task.description && save({ description }, "description")}
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.description || "No description."}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">
          Checklist {checklist.length ? <span className="font-normal text-ink-4">{done}/{checklist.length}</span> : null}
        </h3>
        <ul className="flex flex-col">
          {checklist.map((i) => (
            <li key={i.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 hover:bg-sunken max-lg:min-h-11">
                <input type="checkbox" checked={i.done} disabled={!editable} onChange={(e) => toggle(i.id, e.target.checked)} className="size-4 accent-accent" />
                <span className={cn("text-sm", i.done && "text-ink-4 line-through")}>{i.body}</span>
              </label>
            </li>
          ))}
        </ul>
        {editable ? (
          <form onSubmit={addItem} className="flex gap-2">
            <Input aria-label="New checklist item" value={newItem} maxLength={300} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" className="h-8 max-lg:h-10" />
            <Button type="submit" size="icon" aria-label="Add item" className="max-lg:size-10"><Plus aria-hidden className="size-4" /></Button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Comments</h3>
        <p suppressHydrationWarning className="text-[12.5px] text-ink-3">
          Created {timeAgo(task.created_at)}{reporter ? ` by ${reporter.id === currentUserId ? "you" : reporter.name}` : ""}
        </p>
        <Comments initial={comments} target={{ organizationId: org.id, projectId: task.project_id, taskId: task.id }} />
      </section>

      {can("tasks.delete") ? (
        <div className="border-t border-line-soft pt-4">
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-danger-ink max-lg:h-11">
            <Trash2 aria-hidden className="size-4" />Delete task
          </Button>
          <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete ${task.key}?`} actionLabel="Delete task" onConfirm={remove}>
            <p>“{task.title}”, its checklist and comments are removed. The activity log keeps a record that it was deleted.</p>
          </ConfirmDialog>
        </div>
      ) : null}
    </div>
  );
}
