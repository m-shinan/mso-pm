"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bug, FileText, Link2 } from "lucide-react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/badge";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { PriorityIcon, SeverityBadge, StatusIcon } from "@/components/domain/markers";
import { StatusPicker, useOptimisticStatus } from "@/components/domain/status-picker";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IssueRow } from "./queries";

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
      <EmptyState icon={Bug} title="No open issues">
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
                {showProject ? `${i.projectName} · ` : ""}
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

export function IssueDrawer({ issue }: { issue: IssueRow | null }) {
  const router = useRouter();
  const hrefFor = useIssueHref();
  const { config, member, href } = useOrg();
  // Keyed by id below so the optimistic status resets when another issue opens.
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
        <IssueDetail key={issue.id} issue={issue} config={config} member={member} />
      </DrawerContent>
    </Dialog>
  );
}

function IssueDetail({ issue, config, member }: { issue: IssueRow } & Pick<ReturnType<typeof useOrg>, "config" | "member">) {
  const [statusId, setStatus] = useOptimisticStatus(issue.statusId, issue.key);
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
        <dd className="flex items-center gap-1.5"><Avatar person={reporter} size="xs" />{reporter?.name}</dd>
        <dt className="text-ink-4">Environment</dt>
        <dd>{issue.environment}</dd>
      </dl>

      <hr className="border-line-soft" />

      {issue.steps.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Steps to reproduce</h3>
          <ol className="list-decimal pl-5 text-base leading-relaxed text-[#2A2A30]">
            {issue.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-ink-4">No steps to reproduce yet.</p>
      )}
      {issue.expected || issue.actual ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2.5">
            <h3 className="text-xs font-semibold text-ink-3">Expected</h3>
            <p className="text-sm leading-normal">{issue.expected}</p>
          </section>
          <section className="flex flex-col gap-1.5 rounded-lg border border-danger-line bg-[#FEF7F6] px-3 py-2.5">
            <h3 className="text-xs font-semibold text-danger-ink">Actual</h3>
            <p className="text-sm leading-normal">{issue.actual}</p>
          </section>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Attachments</h3>
        {/* Metadata only; files open through short-lived signed URLs (phase 5). */}
        <p className="flex items-center gap-2 text-sm text-ink-4"><FileText aria-hidden className="size-4" />None yet</p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-semibold">Activity</h3>
        <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <span aria-hidden className="size-1.5 rounded-full bg-ink-6" />
          <span suppressHydrationWarning><span className="font-medium text-ink">{reporter?.name.split(" ")[0]}</span> reported this · {timeAgo(issue.createdAt)}</span>
        </p>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-line px-3 max-lg:h-12">
          <input aria-label="Write a comment" placeholder="Write a comment…" className="grow bg-transparent text-sm outline-none max-lg:text-lg" />
          <Kbd className="max-lg:hidden">Ctrl ↵</Kbd>
        </label>
      </section>
    </div>
  );
}
