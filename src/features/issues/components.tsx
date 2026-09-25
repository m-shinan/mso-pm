"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bug, Link2, Plus } from "lucide-react";
import { Attachments } from "@/components/domain/attachments";
import type { AttachmentRow } from "@/features/tasks/queries";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DrawerContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { PriorityIcon, SeverityBadge, StatusIcon } from "@/components/domain/markers";
import { StatusPicker, useOptimisticStatus } from "@/components/domain/status-picker";
import { Comments } from "@/components/domain/comments";
import { friendlyError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createIssue, setIssueStatus } from "./mutations";
import type { CommentRow, IssueRow } from "./queries";

function useIssueHref() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string | null) => {
    const next = new URLSearchParams(params);
    if (key) next.set("issue", key.toLowerCase());
    else next.delete("issue");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
}

export function IssueList({ issues, showProject = true }: { issues: IssueRow[]; showProject?: boolean }) {
  const { config, member, org } = useOrg();
  const params = useSearchParams();
  const hrefFor = useIssueHref();
  const selected = params.get("issue");

  if (issues.length === 0) {
    return (
      <EmptyState icon={Bug} title="No issues here" action={<ReportIssueButton />}>
        Bugs reported in {org.name} projects show up here, most severe first.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {issues.map((i) => {
        const on = selected === i.key.toLowerCase();
        return (
          <Link
            key={i.id}
            href={hrefFor(i.key)}
            scroll={false}
            aria-current={on ? "true" : undefined}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-line-soft px-3.5 py-3 first:border-t-0 lg:h-[50px] lg:grid-cols-[70px_60px_minmax(0,1fr)_16px_22px_32px] lg:py-0",
              on ? "bg-[#F3F6FD]" : "hover:bg-sunken",
            )}
          >
            <SeverityBadge severity={config.get(i.severityId)} className="w-[70px] max-lg:order-2 max-lg:justify-self-end" />
            <span className="hidden font-mono text-2xs text-ink-4 lg:block">{i.key}</span>
            <span className="flex min-w-0 flex-col gap-px max-lg:order-1">
              <span className="truncate font-medium max-lg:text-[14.5px]">{i.title}</span>
              <span className="truncate text-xs text-ink-4">
                <span className="lg:hidden">{i.key} · </span>
                {showProject ? `${i.projectName}` : ""}
                {showProject && i.environment ? " · " : ""}
                {i.environment}
              </span>
            </span>
            <StatusIcon status={config.get(i.statusId)} glyph={config.glyph(i.statusId)} className="max-lg:hidden" />
            <Avatar person={member(i.assigneeId)} className="max-lg:hidden" />
            <span suppressHydrationWarning className="hidden text-right text-xs text-ink-4 lg:block">{timeAgo(i.createdAt).replace(" ago", "")}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function IssueDrawer({ issue, comments, attachments }: { issue: IssueRow | null; comments: CommentRow[]; attachments: AttachmentRow[] }) {
  const router = useRouter();
  const hrefFor = useIssueHref();
  const { href } = useOrg();
  if (!issue) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && router.push(hrefFor(null), { scroll: false })}>
      <DrawerContent
        label={`Issue ${issue.key}`}
        header={
          <>
            <span className="font-mono text-xs text-ink-3">{issue.key}</span>
            <span aria-hidden className="text-ink-6">·</span>
            <Link href={href(`/projects/${issue.projectKey.toLowerCase()}`)} className="text-[12.5px] text-accent hover:text-accent-hover">
              {issue.projectName}
            </Link>
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
        <IssueDetail key={issue.id} issue={issue} comments={comments} attachments={attachments} />
      </DrawerContent>
    </Dialog>
  );
}

function IssueDetail({ issue, comments, attachments }: { issue: IssueRow; comments: CommentRow[]; attachments: AttachmentRow[] }) {
  const { config, member, org } = useOrg();
  const router = useRouter();
  const [statusId, setStatus] = useOptimisticStatus(issue.statusId, issue.key, async (s) => {
    const res = await setIssueStatus(issue.id, s);
    if (!res.error) router.refresh();
    return res;
  });
  const reporter = member(issue.reporterId);
  const assignee = member(issue.assigneeId);
  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <h2 className="text-xl leading-snug font-semibold tracking-[-0.01em]">{issue.title}</h2>

      <dl className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm">
        <dt className="text-ink-4">Status</dt>
        <dd className="flex items-center gap-1.5">
          <StatusPicker kind="issue_status" value={statusId} onChange={setStatus} label={issue.key} subtitle={issue.title} className="size-7 max-lg:size-10" />
          {config.get(statusId)?.name}
        </dd>
        <dt className="text-ink-4">Severity</dt>
        <dd><SeverityBadge severity={config.get(issue.severityId)} /></dd>
        <dt className="text-ink-4">Priority</dt>
        <dd className="flex items-center gap-1.5"><PriorityIcon priority={config.get(issue.priorityId)} />{config.get(issue.priorityId)?.name}</dd>
        <dt className="text-ink-4">Assignee</dt>
        <dd className="flex items-center gap-1.5"><Avatar person={assignee} size="xs" />{assignee?.name ?? "Unassigned"}</dd>
        <dt className="text-ink-4">Reporter</dt>
        <dd className="flex items-center gap-1.5"><Avatar person={reporter} size="xs" />{reporter?.name ?? "Former member"}</dd>
        {issue.environment ? (
          <>
            <dt className="text-ink-4">Environment</dt>
            <dd>{issue.environment}</dd>
          </>
        ) : null}
      </dl>

      <hr className="border-line-soft" />

      {issue.steps.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Steps to reproduce</h3>
          <ol className="list-decimal pl-5 text-base leading-relaxed text-[#2A2A30]">
            {issue.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-ink-4">No steps to reproduce yet.</p>
      )}
      {issue.expected || issue.actual ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2.5">
            <h3 className="text-xs font-semibold text-ink-3">Expected</h3>
            <p className="text-sm leading-normal whitespace-pre-line">{issue.expected || "—"}</p>
          </section>
          <section className="flex flex-col gap-1.5 rounded-lg border border-danger-line bg-[#FEF7F6] px-3 py-2.5">
            <h3 className="text-xs font-semibold text-danger-ink">Actual</h3>
            <p className="text-sm leading-normal whitespace-pre-line">{issue.actual || "—"}</p>
          </section>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Screenshots and files</h3>
        <Attachments initial={attachments} target={{ projectId: issue.projectId, issueId: issue.id }} />
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Activity</h3>
        <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <span aria-hidden className="size-1.5 rounded-full bg-ink-6" />
          <span suppressHydrationWarning>
            <span className="font-medium text-ink">{reporter?.name.split(" ")[0] ?? "Someone"}</span> reported this · {timeAgo(issue.createdAt)}
          </span>
        </p>
        <Comments initial={comments} target={{ organizationId: org.id, projectId: issue.projectId, issueId: issue.id }} />
      </section>
    </div>
  );
}

/** "Report issue": the fields a useful bug report needs, nothing more. */
export function ReportIssueButton({ projectId }: { projectId?: string }) {
  const { org, config, members, projects, can, currentUserId, href } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  if (!can("issues.create") || projects.length === 0) return null;

  const severities = config.ofKind("issue_severity");
  const priorities = config.ofKind("task_priority");
  const statuses = config.ofKind("issue_status");
  const def = (l: typeof severities) => l.find((o) => o.isDefault)?.id ?? l[0]?.id;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const title = String(d.get("title") ?? "").trim();
    if (!title) return setError("Describe the problem in a few words.");
    setSaving(true);
    const { data, error: dbError } = await createIssue(
      {
        organizationId: org.id,
        projectId: String(d.get("project")),
        title,
        statusId: def(statuses)!,
        severityId: String(d.get("severity")),
        priorityId: String(d.get("priority")),
        assigneeId: String(d.get("assignee") ?? "") || null,
        environment: String(d.get("environment") ?? ""),
        steps: String(d.get("steps") ?? "").split("\n"),
        expected: String(d.get("expected") ?? ""),
        actual: String(d.get("actual") ?? ""),
      },
      currentUserId,
    );
    setSaving(false);
    if (dbError || !data) return setError(friendlyError(dbError, "report the issue"));
    setOpen(false);
    const key = `${data.project?.key}-${data.number}`;
    toast({ message: <>{key} reported</> });
    router.push(href(`/issues?issue=${key.toLowerCase()}`));
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(undefined); }}>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />Report issue
      </Button>
      <DialogContent
        title="Report an issue"
        className="lg:w-[600px]"
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="report-issue" disabled={saving} className="max-lg:h-11">{saving ? "Reporting…" : "Report issue"}</Button>
          </>
        }
      >
        <form id="report-issue" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label="What’s wrong?" error={error}>
            {(p) => <Input {...p} name="title" autoFocus placeholder="e.g. Checkout fails on Apple Pay" onChange={() => setError(undefined)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              {(p) => (
                <Select {...p} name="project" defaultValue={projectId ?? projects[0]?.id}>
                  {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Severity">
              {(p) => (
                <Select {...p} name="severity" defaultValue={def(severities)}>
                  {[...severities].reverse().map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(p) => (
                <Select {...p} name="priority" defaultValue={def(priorities)}>
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
          </div>
          <Field label="Environment" hint="e.g. Production · iOS 17, Safari">
            {(p) => <Input {...p} name="environment" />}
          </Field>
          <Field label="Steps to reproduce" hint="One step per line.">
            {(p) => <Textarea {...p} name="steps" rows={3} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expected">{(p) => <Textarea {...p} name="expected" rows={2} className="min-h-16" />}</Field>
            <Field label="Actual">{(p) => <Textarea {...p} name="actual" rows={2} className="min-h-16" />}</Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
