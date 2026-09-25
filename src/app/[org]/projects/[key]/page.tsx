import { notFound } from "next/navigation";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskBoard } from "@/features/tasks/board";
import { listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectBoardPage({ params }: PageProps<"/[org]/projects/[key]">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const tasks = await listProjectTasks(org.id, project.id);
  return (
    <main className="flex min-h-0 grow flex-col pt-4">
      <TaskBoard tasks={tasks} projectId={project.id} />
    </main>
  );
}
