import { notFound } from "next/navigation";
import { IssueDrawer, IssueList, ReportIssueButton } from "@/features/issues/components";
import { getIssue, listComments, listIssues } from "@/features/issues/queries";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";

export default async function ProjectIssuesPage({ params, searchParams }: PageProps<"/[org]/projects/[key]/issues">) {
  const { key } = await params;
  const { org, ctx } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const issueKey = typeof sp.issue === "string" ? sp.issue : null;
  const [issues, selected] = await Promise.all([
    listIssues(org.id, ctx.options, { projectId: project.id, state: "all" }),
    issueKey ? getIssue(org.id, issueKey) : null,
  ]);
  const comments = selected ? await listComments({ issueId: selected.id }) : [];
  return (
    <main className="flex flex-col gap-3 px-4 py-4 lg:px-8">
      <div className="flex justify-end"><ReportIssueButton projectId={project.id} /></div>
      <IssueList issues={issues} showProject={false} />
      <IssueDrawer issue={selected} comments={comments} />
    </main>
  );
}
