import { FolderPlus } from "lucide-react";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/states";
import { requireOrg } from "@/features/org/queries";
import { ProjectList } from "@/features/projects/components";
import { NewProjectButton } from "@/features/projects/forms";
import { listProjects } from "@/features/projects/queries";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ params, searchParams }: PageProps<"/[org]/projects">) {
  const { org } = await requireOrg(params);
  const sp = await searchParams;
  const projects = await listProjects(org.id);
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Projects" }]} actions={<NewProjectButton autoOpen={sp.new === "1"} />} />
      <main className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
        <PageTitle title="Projects" eyebrow={`${projects.length} in ${org.name}`}>
          <span className="lg:hidden"><NewProjectButton /></span>
        </PageTitle>
        {projects.length === 0 ? (
          <EmptyState icon={FolderPlus} title="No projects yet" action={<NewProjectButton />}>
            Create a project to start tracking tasks, issues and releases for a client.
          </EmptyState>
        ) : (
          <ProjectList projects={projects} />
        )}
      </main>
    </>
  );
}
