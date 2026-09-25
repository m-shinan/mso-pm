import { notFound } from "next/navigation";
import { listComments } from "@/features/issues/queries";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskDrawer } from "@/features/tasks/drawer";
import { TaskList } from "@/features/tasks/list";
import { getTaskByKey, listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectListPage({ params, searchParams }: PageProps<"/[org]/projects/[key]/list">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const taskKey = typeof sp.task === "string" ? sp.task : null;
  const [tasks, task] = await Promise.all([listProjectTasks(org.id, project.id), taskKey ? getTaskByKey(org.id, taskKey) : null]);
  const comments = task ? await listComments({ taskId: task.id }) : [];
  return (
    <main className="px-4 py-4 lg:px-8">
      <TaskList tasks={tasks} />
      <TaskDrawer task={task} comments={comments} />
    </main>
  );
}
