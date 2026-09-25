import { notFound } from "next/navigation";
import { listComments } from "@/features/issues/queries";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskBoard } from "@/features/tasks/board";
import { TaskDrawer } from "@/features/tasks/drawer";
import { getTaskByKey, listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectBoardPage({ params, searchParams }: PageProps<"/[org]/projects/[key]">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const taskKey = typeof sp.task === "string" ? sp.task : null;
  const [tasks, task] = await Promise.all([listProjectTasks(org.id, project.id), taskKey ? getTaskByKey(org.id, taskKey) : null]);
  const comments = task ? await listComments({ taskId: task.id }) : [];
  return (
    <main className="flex min-h-0 grow flex-col pt-4">
      <TaskBoard tasks={tasks} projectId={project.id} />
      <TaskDrawer task={task} comments={comments} />
    </main>
  );
}
