"use client";

import { Flag, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { daysFromToday, formatDate, percent } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { MilestoneRow } from "@/features/tasks/queries";

function MilestoneDialog({ projectId, milestone, open, onOpenChange }: { projectId: string; milestone?: MilestoneRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { org } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const next: Record<string, string> = {};
    if (!v("name")) next.name = "Name the milestone.";
    if (v("start") && v("due") && v("due") < v("start")) next.due = "The due date is before the start date.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const row = { name: v("name"), description: v("description"), start_date: v("start") || null, due_date: v("due") || null };
    const db = supabaseBrowser().from("milestones");
    const { error } = milestone
      ? await db.update(row).eq("id", milestone.id).select("id").single()
      : await db.insert({ ...row, organization_id: org.id, project_id: projectId }).select("id").single();
    if (error) return setErrors({ form: friendlyError(error, "save the milestone") });
    onOpenChange(false);
    toast({ message: milestone ? "Milestone saved" : `${row.name} added` });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setErrors({}); }}>
      <DialogContent
        title={milestone ? `Edit ${milestone.name}` : "New milestone"}
        footer={
          <>
            <Button onClick={() => onOpenChange(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="milestone-form" className="max-lg:h-11">{milestone ? "Save" : "Add milestone"}</Button>
          </>
        }
      >
        <form id="milestone-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-3">
          {errors.form ? <p role="alert" className="col-span-2 text-sm text-danger-ink">{errors.form}</p> : null}
          <Field label="Name" error={errors.name} className="col-span-2">
            {(p) => <Input {...p} name="name" defaultValue={milestone?.name} maxLength={80} autoFocus placeholder="e.g. UI design sign-off" />}
          </Field>
          <Field label="Start">{(p) => <Input {...p} name="start" type="date" defaultValue={milestone?.start_date ?? ""} />}</Field>
          <Field label="Due" error={errors.due}>{(p) => <Input {...p} name="due" type="date" defaultValue={milestone?.due_date ?? ""} />}</Field>
          <Field label="Description" className="col-span-2">{(p) => <Textarea {...p} name="description" rows={2} className="min-h-16" maxLength={2000} defaultValue={milestone?.description} />}</Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MilestonesView({ projectId, projectKey, milestones }: { projectId: string; projectKey: string; milestones: MilestoneRow[] }) {
  const { config, can, href } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const manage = can("releases.manage");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MilestoneRow | null>(null);
  const [deleting, setDeleting] = useState<MilestoneRow | null>(null);

  async function remove(m: MilestoneRow) {
    const { error } = await supabaseBrowser().from("milestones").delete().eq("id", m.id).select("id").single();
    if (error) return toast({ message: friendlyError(error, "delete the milestone") });
    toast({ message: `${m.name} deleted. Its tasks keep everything else.` });
    router.refresh();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {manage ? (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)} className="max-lg:h-11"><Plus aria-hidden className="size-[15px]" strokeWidth={2} />New milestone</Button>
        </div>
      ) : null}
      {milestones.length === 0 ? (
        <EmptyState icon={Flag} title="No milestones yet" action={manage ? <Button onClick={() => setCreating(true)}>Add the first one</Button> : undefined}>
          Break the project into stages like Requirements, UI design, Development, Testing, Launch.
        </EmptyState>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-line bg-surface">
          {milestones.map((m) => {
            const done = m.tasks.filter((t) => config.get(t.status_id)?.category === "completed").length;
            const pct = percent(done, m.tasks.length);
            const left = m.due_date ? daysFromToday(m.due_date) : null;
            const late = left !== null && left < 0 && pct < 100;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft px-4 py-3 first:border-t-0">
                <Flag aria-hidden className={cn("size-4 shrink-0", pct === 100 ? "text-[#2F8F5B]" : late ? "text-late" : "text-ink-4")} />
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="font-medium">{m.name}</span>
                  <span className={cn("text-xs", late ? "text-late" : "text-ink-4")}>
                    {m.start_date ? `${formatDate(m.start_date)} → ` : ""}
                    {m.due_date ? formatDate(m.due_date, { year: true }) : "No due date"}
                    {late ? ` · ${-left!} days late` : left !== null && left >= 0 && pct < 100 ? ` · ${left} days left` : ""}
                  </span>
                  {m.description ? <span className="text-xs text-ink-3">{m.description}</span> : null}
                </div>
                <Link href={href(`/projects/${projectKey.toLowerCase()}?milestone=${m.id}`)} className="flex items-center gap-2 text-sm text-ink-2 hover:text-accent">
                  <Progress value={pct} tone={pct === 100 ? "done" : "accent"} className="w-24" />
                  <span className="tabular">{done}/{m.tasks.length}</span>
                </Link>
                {manage ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)} className="max-lg:h-10">Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(m)} className="text-danger-ink max-lg:h-10">Delete</Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-ink-4">Put a task in a milestone from the task’s panel. Progress counts tasks whose status counts as completed.</p>
      <MilestoneDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
      {editing ? <MilestoneDialog key={editing.id} projectId={projectId} milestone={editing} open onOpenChange={(v) => !v && setEditing(null)} /> : null}
      <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title={`Delete “${deleting?.name}”?`} actionLabel="Delete milestone" onConfirm={() => deleting && remove(deleting)}>
        <p>Its {deleting?.tasks.length ?? 0} tasks stay in the project; they just won’t belong to a milestone any more.</p>
      </ConfirmDialog>
    </div>
  );
}
