"use client";

import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useOrg } from "./org-provider";

const OPEN_EVENT = "mso:open-create";
export function openCreate(projectId?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { projectId } }));
}

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Header button for the same dialog. */
export function NewTaskButton({ projectId }: { projectId?: string }) {
  const { can } = useOrg();
  if (!can("tasks.create")) return null;
  return (
    <Button variant="primary" onClick={() => openCreate(projectId)} className="pr-2.5">
      <Plus aria-hidden className="size-[15px]" strokeWidth={2} />
      New task
      <Kbd className="border-0 bg-white/20 text-white">C</Kbd>
    </Button>
  );
}

export function QuickCreate() {
  const { config, members, projects, can } = useOrg();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      setProjectId(detail?.projectId ?? projects[0]?.id ?? "");
      setError(undefined);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        onOpen(new CustomEvent(OPEN_EVENT));
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [projects]);

  if (!can("tasks.create")) return null;

  const statuses = config.ofKind("task_status");
  const priorities = config.ofKind("task_priority");
  const defaultOf = (list: typeof statuses) => list.find((o) => o.isDefault)?.id ?? list[0]?.id;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("Give the task a title.");
      return;
    }
    // Phase 4 replaces this with an optimistic insert into the tasks table.
    setOpen(false);
    toast({ message: <>Task “{title}” created · sample data, not saved yet</> });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="New task"
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="quick-create" className="max-lg:h-11">Create task</Button>
          </>
        }
      >
        <form id="quick-create" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={error}>
            {(p) => <Input {...p} name="title" autoFocus placeholder="What needs doing?" onChange={() => setError(undefined)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              {(p) => (
                <Select {...p} name="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Status">
              {(p) => (
                <Select {...p} name="status" defaultValue={defaultOf(statuses)}>
                  {statuses.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(p) => (
                <Select {...p} name="priority" defaultValue={defaultOf(priorities)}>
                  {priorities.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Assignee">
              {(p) => (
                <Select {...p} name="assignee" defaultValue="">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Due date" className="col-span-2 sm:col-span-1">
              {(p) => <Input {...p} name="due" type="date" />}
            </Field>
          </div>
          <Field label="Description" hint="Optional. Markdown is supported.">
            {(p) => <Textarea {...p} name="description" rows={3} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
