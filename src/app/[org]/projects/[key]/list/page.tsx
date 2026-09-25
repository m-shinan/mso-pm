import { notFound } from "next/navigation";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskDrawer } from "@/features/tasks/drawer";
import { TaskList } from "@/features/tasks/list";
import { loadProjectExtras } from "@/features/tasks/load-drawer";
import { listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectListPage({ params, searchParams }: PageProps<"/[org]/projects/[key]/list">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const tasks = await listProjectTasks(org.id, project.id);
  const { task, comments, extras } = await loadProjectExtras(org.id, project.id, tasks, typeof sp.task === "string" ? sp.task : null);
  return (
    <main className="px-4 py-4 lg:px-8">
      <TaskList tasks={tasks} milestones={extras.milestones} />
      <TaskDrawer task={task} comments={comments} extras={extras} />
    </main>
  );
}
