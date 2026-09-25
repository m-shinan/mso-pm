"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createTask } from "@/features/tasks/mutations";
import { friendlyError } from "@/lib/errors";
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
  const { org, config, members, projects, can, currentUserId, href } = useOrg();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ projectId?: string }>).detail;
      // Default to the project being viewed, if any.
      const keyInUrl = window.location.pathname.split("/projects/")[1]?.split("/")[0]?.toUpperCase();
      const fromUrl = projects.find((p) => p.key === keyInUrl)?.id;
      setProjectId(detail?.projectId ?? fromUrl ?? projects[0]?.id ?? "");
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) {
      setError("Give the task a title.");
      return;
    }
    if (title.length > 200) {
      setError("Keep the title under 200 characters.");
      return;
    }
    setSaving(true);
    const { data: created, error: dbError } = await createTask(
      {
        organizationId: org.id,
        projectId,
        title,
        description: String(data.get("description") ?? ""),
        statusId: String(data.get("status")),
        priorityId: String(data.get("priority")),
        assigneeId: String(data.get("assignee") ?? "") || null,
        dueDate: String(data.get("due") ?? "") || null,
      },
      currentUserId,
    );
    setSaving(false);
    if (dbError || !created) {
      setError(friendlyError(dbError, "create the task"));
      return;
    }
    setOpen(false);
    const key = projects.find((p) => p.id === projectId)?.key;
    toast({ message: <>{key}-{created.number} created</> });
    router.refresh();
  }

  if (projects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {can("projects.create") ? (
          <DialogContent title="New task" description="Tasks live in projects. Create a project first.">
            <Button variant="primary" onClick={() => { setOpen(false); router.push(href("/projects?new=1")); }} className="max-lg:h-11">New project</Button>
          </DialogContent>
        ) : (
          <DialogContent title="New task" description="You’re not on any projects yet. Ask an admin or project manager to add you to one." />
        )}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="New task"
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="quick-create" disabled={saving} className="max-lg:h-11">{saving ? "Creating…" : "Create task"}</Button>
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
                  {members.filter((m) => m.status === "active").map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Due date" className="col-span-2 sm:col-span-1">
              {(p) => <Input {...p} name="due" type="date" />}
            </Field>
          </div>
          <Field label="Description" hint="Optional.">
            {(p) => <Textarea {...p} name="description" rows={3} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
