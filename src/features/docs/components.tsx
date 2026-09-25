"use client";

import { Plus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

// Looks like a credential: long random-ish tokens or "password: x" lines.
const SECRET_HINTS = [
  /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i,
  /\b(sk|pk|sb|ghp|gho|xox[bp])_[A-Za-z0-9]{16,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];

export function SecretsNote() {
  return (
    <p className="flex max-w-2xl items-start gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm leading-normal text-ink-2">
      <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
      Don’t paste passwords, API keys or database credentials here. Write where the secret lives (for example “Vercel env: STRIPE_KEY”), not the secret itself.
    </p>
  );
}

export function NewDocButton({ projectId }: { projectId?: string }) {
  const { org, projects, can, href } = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  if (!can("docs.edit") || projects.length === 0) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const title = String(d.get("title") ?? "").trim();
    if (!title) return setError("Give the document a title.");
    const { data, error: dbError } = await supabaseBrowser()
      .from("documents")
      .insert({ organization_id: org.id, project_id: String(d.get("project")), title })
      .select("id")
      .single();
    if (dbError || !data) return setError(friendlyError(dbError, "create the document"));
    setOpen(false);
    router.push(href(`/docs/${data.id}?edit=1`));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(undefined); }}>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />New document
      </Button>
      <DialogContent
        title="New document"
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="new-doc" className="max-lg:h-11">Create</Button>
          </>
        }
      >
        <form id="new-doc" onSubmit={submit} noValidate className="flex flex-col gap-3">
          <Field label="Title" error={error}>{(p) => <Input {...p} name="title" maxLength={120} autoFocus placeholder="e.g. Deployment notes" />}</Field>
          <Field label="Project">
            {(p) => (
              <Select {...p} name="project" defaultValue={projectId ?? projects[0]?.id}>
                {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            )}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocEditor({
  doc,
  startEditing,
}: {
  doc: { id: string; title: string; body: string; updated_at: string; updated_by: string | null };
  startEditing: boolean;
}) {
  const { can, member, currentUserId, href } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const editable = can("docs.edit");
  const [editing, setEditing] = useState(startEditing && editable);
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const looksSecret = SECRET_HINTS.some((re) => re.test(body));

  async function save() {
    if (!title.trim()) return toast({ message: "The document needs a title." });
    setSaving(true);
    const { error } = await supabaseBrowser()
      .from("documents")
      .update({ title: title.trim(), body, updated_by: currentUserId })
      .eq("id", doc.id)
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast({ message: friendlyError(error, "save the document") });
    setEditing(false);
    toast({ message: "Saved" });
    router.refresh();
  }

  async function remove() {
    const { error } = await supabaseBrowser().from("documents").delete().eq("id", doc.id).select("id").single();
    if (error) return toast({ message: friendlyError(error, "delete the document") });
    router.replace(href("/docs"));
    router.refresh();
  }

  if (!editing) {
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{doc.title}</h1>
            <span suppressHydrationWarning className="text-xs text-ink-4">
              Updated {timeAgo(doc.updated_at)}{doc.updated_by ? ` by ${member(doc.updated_by)?.name ?? "a former member"}` : ""}
            </span>
          </div>
          {editable ? (
            <div className="flex gap-2">
              <Button onClick={() => setEditing(true)} className="max-lg:h-11">Edit</Button>
              <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-danger-ink max-lg:h-11">Delete</Button>
            </div>
          ) : null}
        </div>
        {doc.body ? (
          <div className="rounded-lg border border-line bg-surface px-5 py-4 text-base leading-relaxed whitespace-pre-wrap text-ink">{doc.body}</div>
        ) : (
          <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-4">This document is empty.</p>
        )}
        <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete “${doc.title}”?`} actionLabel="Delete document" onConfirm={remove}>
          <p>The document is removed for everyone in this project. This can’t be undone.</p>
        </ConfirmDialog>
      </article>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="h-11 text-xl font-semibold" />
      <Textarea
        aria-label="Content"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={100000}
        rows={18}
        className="font-mono text-sm leading-relaxed"
        placeholder={"Setup\n1. Clone the repo\n2. Copy .env.example to .env.local\n\nDeploy\n- Vercel project: …"}
      />
      {looksSecret ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
          This looks like it contains a password or key. Remove it and note where the secret is stored instead.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" onClick={save} disabled={saving} className="max-lg:h-11">{saving ? "Saving…" : "Save"}</Button>
        <Button onClick={() => { setTitle(doc.title); setBody(doc.body); setEditing(false); }} className="max-lg:h-11">Cancel</Button>
      </div>
    </div>
  );
}
