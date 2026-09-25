import Link from "next/link";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { buttonClass } from "@/components/ui/button";
import { IssueDrawer, IssueList, ReportIssueButton } from "@/features/issues/components";
import { getIssue, listComments, listIssueAttachments, listIssues } from "@/features/issues/queries";
import { requireOrg } from "@/features/org/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Issues" };

const STATES = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;

export default async function IssuesPage({ params, searchParams }: PageProps<"/[org]/issues">) {
  const { org, ctx } = await requireOrg(params);
  const sp = await searchParams;
  const state = STATES.find((s) => s.id === sp.state)?.id ?? "open";
  const key = typeof sp.issue === "string" ? sp.issue : null;
  const [issues, selected] = await Promise.all([listIssues(org.id, ctx.options, { state }), key ? getIssue(org.id, key) : null]);
  const [comments, attachments] = selected ? await Promise.all([listComments({ issueId: selected.id }), listIssueAttachments(selected.id)]) : [[], []];

  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Issues" }]} actions={<ReportIssueButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Issues">
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Issue state" className="flex gap-0.5">
              {STATES.map((s) => (
                <Link
                  key={s.id}
                  role="tab"
                  aria-selected={state === s.id}
                  href={s.id === "open" ? `/${org.slug}/issues` : `/${org.slug}/issues?state=${s.id}`}
                  className={cn(buttonClass("ghost", "sm"), "text-sm max-lg:h-9", state === s.id && "bg-muted text-ink")}
                >
                  {s.label}
                  {state === s.id ? <span className="font-normal text-ink-4">{issues.length}</span> : null}
                </Link>
              ))}
            </div>
            <span className="lg:hidden"><ReportIssueButton /></span>
          </div>
        </PageTitle>
        <p className="text-[12.5px] text-ink-4">Sorted by severity, then newest.</p>
        <IssueList issues={issues} />
      </main>
      <IssueDrawer issue={selected} comments={comments} attachments={attachments} />
    </>
  );
}
