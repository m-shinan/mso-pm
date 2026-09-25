"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ProjectDetail } from "./queries";

interface ClientOption {
  id: string;
  name: string;
}

function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  return /^[A-Z]/.test(key) ? key.slice(0, 6) : "";
}

const URL_RE = /^https?:\/\/\S+$/;

/** Create or edit a project. Validation mirrors the database constraints. */
function ProjectForm({
  project,
  clients,
  onDone,
}: {
  project?: ProjectDetail;
  clients: ClientOption[];
  onDone: (key: string) => void;
}) {
  const { org, config, currentUserId } = useOrg();
  const [name, setName] = useState(project?.name ?? "");
  const [key, setKey] = useState(project?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(Boolean(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const effectiveKey = keyTouched ? key : suggestKey(name);
  const def = (kind: Parameters<typeof config.ofKind>[0]) => config.ofKind(kind).find((o) => o.isDefault)?.id ?? config.ofKind(kind)[0]?.id;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Give the project a name.";
    if (!/^[A-Z][A-Z0-9]{1,5}$/.test(effectiveKey)) next.key = "2–6 capital letters or digits, starting with a letter (e.g. SKR).";
    if (v("start") && v("due") && v("due") < v("start")) next.due = "The deadline is before the start date.";
    for (const k of ["repo", "prod", "staging"]) if (v(k) && !URL_RE.test(v(k))) next[k] = "Use a full link starting with https://";
    setErrors(next);
    if (Object.keys(next).length) return;

    const row = {
      name: name.trim(),
      description: v("description"),
      client_id: v("client") || null,
      type_id: v("type"),
      status_id: v("status"),
      priority_id: v("priority"),
      start_date: v("start") || null,
      due_date: v("due") || null,
      repo_url: v("repo") || null,
      prod_url: v("prod") || null,
      staging_url: v("staging") || null,
    };
    setSaving(true);
    const db = supabaseBrowser().from("projects");
    const { data, error } = project
      ? await db.update(row).eq("id", project.id).select("key").single()
      : await db.insert({ ...row, key: effectiveKey, organization_id: org.id, created_by: currentUserId }).select("key").single();
    setSaving(false);
    if (error || !data) {
      if (error?.code === "23505") return setErrors({ key: "Another project already uses that key." });
      return setErrors({ form: friendlyError(error, project ? "save the project" : "create the project") });
    }
    onDone(data.key);
  }

  return (
    <form id="project-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      {errors.form ? <p role="alert" className="text-sm text-danger-ink">{errors.form}</p> : null}
      <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
        <Field label="Name" error={errors.name}>
          {(p) => <Input {...p} value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Key" error={errors.key} hint={project ? "Fixed" : "e.g. SKR"}>
          {(p) => (
            <Input
              {...p}
              value={effectiveKey}
              maxLength={6}
              disabled={Boolean(project)}
              onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase()); }}
              className="font-mono uppercase"
            />
          )}
        </Field>
      </div>
      <Field label="Description">{(p) => <Textarea {...p} name="description" rows={2} className="min-h-16" maxLength={2000} defaultValue={project?.description} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client">
          {(p) => (
            <Select {...p} name="client" defaultValue={project?.clientId ?? ""}>
              <option value="">Internal / none</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} name="type" defaultValue={project?.typeId ?? def("project_type")}>
              {config.ofKind("project_type").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select {...p} name="status" defaultValue={project?.statusId ?? def("project_status")}>
              {config.ofKind("project_status").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(p) => (
            <Select {...p} name="priority" defaultValue={project?.priorityId ?? def("task_priority")}>
              {config.ofKind("task_priority").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Start date">{(p) => <Input {...p} name="start" type="date" defaultValue={project?.startDate ?? ""} />}</Field>
        <Field label="Deadline" error={errors.due}>{(p) => <Input {...p} name="due" type="date" defaultValue={project?.dueDate ?? ""} />}</Field>
      </div>
      <details className="rounded-lg border border-line px-3 py-2" open={Boolean(project?.links.repo || project?.links.prod)}>
        <summary className="cursor-pointer text-sm font-medium text-ink-2">Links</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Repository" error={errors.repo}>{(p) => <Input {...p} name="repo" type="url" placeholder="https://github.com/…" defaultValue={project?.links.repo ?? ""} />}</Field>
          <Field label="Production" error={errors.prod}>{(p) => <Input {...p} name="prod" type="url" defaultValue={project?.links.prod ?? ""} />}</Field>
          <Field label="Staging" error={errors.staging}>{(p) => <Input {...p} name="staging" type="url" defaultValue={project?.links.staging ?? ""} />}</Field>
        </div>
      </details>
      <button type="submit" hidden disabled={saving} />
    </form>
  );
}

function useClients(enabled: boolean) {
  const { org } = useOrg();
  const [clients, setClients] = useState<ClientOption[]>([]);
  useEffect(() => {
    if (!enabled) return;
    supabaseBrowser()
      .from("clients")
      .select("id, name")
      .eq("organization_id", org.id)
      .is("archived_at", null)
      .order("name")
      .then(({ data }) => setClients(data ?? []));
  }, [enabled, org.id]);
  return clients;
}

export function NewProjectButton({ autoOpen }: { autoOpen?: boolean }) {
  const { can, href } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const clients = useClients(open);
  if (!can("projects.create")) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />New project
      </Button>
      <DialogContent
        title="New project"
        className="lg:w-[600px]"
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="project-form" className="max-lg:h-11">Create project</Button>
          </>
        }
      >
        <ProjectForm
          clients={clients}
          onDone={(key) => {
            setOpen(false);
            toast({ message: `${key} created` });
            router.push(href(`/projects/${key.toLowerCase()}`));
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EditProjectDialog({ project, open, onOpenChange }: { project: ProjectDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const toast = useToast();
  const clients = useClients(open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Edit ${project.name}`}
        className="lg:w-[600px]"
        footer={
          <>
            <Button onClick={() => onOpenChange(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="project-form" className="max-lg:h-11">Save changes</Button>
          </>
        }
      >
        <ProjectForm
          project={project}
          clients={clients}
          onDone={() => {
            onOpenChange(false);
            toast({ message: "Project saved" });
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Add or remove people on a project. Developers and viewers only see projects they're on. */
export function ProjectMembersDialog({ project, open, onOpenChange }: { project: ProjectDetail; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { org, members } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [ids, setIds] = useState(new Set(project.memberIds));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(userId: string) {
    setBusy(userId);
    const db = supabaseBrowser().from("project_members");
    const adding = !ids.has(userId);
    const { error } = adding
      ? await db.insert({ project_id: project.id, organization_id: org.id, user_id: userId })
      : await db.delete().eq("project_id", project.id).eq("user_id", userId);
    setBusy(null);
    if (error) return toast({ message: friendlyError(error, adding ? "add the member" : "remove the member") });
    const next = new Set(ids);
    if (adding) next.add(userId);
    else next.delete(userId);
    setIds(next);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`People on ${project.name}`} description="Owners, admins and project managers see every project. Everyone else needs to be added here.">
        <ul className="flex flex-col">
          {members.filter((m) => m.status === "active").map((m) => {
            const seesAll = ["owner", "admin", "project_manager"].includes(m.role);
            return (
              <li key={m.id} className="flex min-h-12 items-center gap-3 border-t border-line-soft py-2 first:border-t-0">
                <Avatar person={m} size="md" />
                <span className="flex grow flex-col">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-ink-4">{m.roleName}{seesAll && !ids.has(m.id) ? " · sees all projects" : ""}</span>
                </span>
                <Button size="sm" disabled={busy === m.id} onClick={() => toggle(m.id)} className="max-lg:h-10">
                  {ids.has(m.id) ? "Remove" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
