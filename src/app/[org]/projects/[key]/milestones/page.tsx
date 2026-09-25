import { notFound } from "next/navigation";
import { MilestonesView } from "@/features/milestones/components";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { listMilestones } from "@/features/tasks/queries";

export default async function ProjectMilestonesPage({ params }: PageProps<"/[org]/projects/[key]/milestones">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const milestones = await listMilestones(org.id, project.id);
  return (
    <main className="px-4 py-4 lg:px-8">
      <MilestonesView projectId={project.id} projectKey={project.key} milestones={milestones} />
    </main>
  );
}
