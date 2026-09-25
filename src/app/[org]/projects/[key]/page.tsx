import { notFound } from "next/navigation";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskBoard } from "@/features/tasks/board";
import { TaskDrawer } from "@/features/tasks/drawer";
import { loadProjectExtras } from "@/features/tasks/load-drawer";
import { listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectBoardPage({ params, searchParams }: PageProps<"/[org]/projects/[key]">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const tasks = await listProjectTasks(org.id, project.id);
  const { task, comments, extras } = await loadProjectExtras(org.id, project.id, tasks, typeof sp.task === "string" ? sp.task : null);
  return (
    <main className="flex min-h-0 grow flex-col pt-4">
      <TaskBoard tasks={tasks} projectId={project.id} milestones={extras.milestones} />
      <TaskDrawer task={task} comments={comments} extras={extras} />
    </main>
  );
}
