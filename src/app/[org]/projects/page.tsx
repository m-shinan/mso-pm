import { FolderPlus } from "lucide-react";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireOrg } from "@/features/org/queries";
import { ProjectList } from "@/features/projects/components";
import { listProjects } from "@/features/projects/queries";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ params }: PageProps<"/[org]/projects">) {
  const { org } = await requireOrg(params);
  const projects = await listProjects(org.id);
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Projects" }]} />
      <main className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
        <PageTitle title="Projects" eyebrow={`${projects.length} in ${org.name}`} />
        {projects.length === 0 ? (
          <EmptyState icon={FolderPlus} title="No projects yet">
            Create a project to start tracking tasks, issues and releases for a client.
          </EmptyState>
        ) : (
          <ProjectList projects={projects} />
        )}
      </main>
    </>
  );
}
