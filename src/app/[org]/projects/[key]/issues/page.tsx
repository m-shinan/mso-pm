import { notFound } from "next/navigation";
import { IssueDrawer, IssueList } from "@/features/issues/components";
import { getIssue, listIssues } from "@/features/issues/queries";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";

export default async function ProjectIssuesPage({ params, searchParams }: PageProps<"/[org]/projects/[key]/issues">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const issueKey = typeof sp.issue === "string" ? sp.issue : null;
  const [issues, selected] = await Promise.all([
    listIssues(org.id, { projectId: project.id, state: "all" }),
    issueKey ? getIssue(org.id, issueKey) : null,
  ]);
  return (
    <main className="px-4 py-4 lg:px-8">
      <IssueList issues={issues} showProject={false} />
      <IssueDrawer issue={selected} />
    </main>
  );
}
