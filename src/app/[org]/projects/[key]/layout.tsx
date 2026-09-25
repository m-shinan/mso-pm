import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/shell/live-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { NewTaskButton } from "@/components/shell/quick-create";
import { requireOrg } from "@/features/org/queries";
import { ProjectHeader, ProjectTabs } from "@/features/projects/project-header";
import { getProjectByKey } from "@/features/projects/queries";

export async function generateMetadata({ params }: LayoutProps<"/[org]/projects/[key]">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectLayout({ children, params }: LayoutProps<"/[org]/projects/[key]">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        orgName={org.name}
        crumbs={[{ label: "Projects", href: `/${org.slug}/projects` }, { label: project.name }]}
        actions={<NewTaskButton projectId={project.id} />}
      />
      <div className="border-b border-line bg-surface px-4 pt-4 lg:px-8 lg:pt-5">
        <ProjectHeader project={project} />
        <ProjectTabs base={`/${org.slug}/projects/${project.key.toLowerCase()}`} />
      </div>
      {children}
      <LiveRefresh
        channel={`project:${project.id}`}
        sources={(["tasks", "issues", "comments"] as const).map((table) => ({ table, filter: `project_id=eq.${project.id}` }))}
      />
    </>
  );
}
