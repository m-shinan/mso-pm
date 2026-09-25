import { notFound } from "next/navigation";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { TaskList } from "@/features/tasks/list";
import { listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectListPage({ params }: PageProps<"/[org]/projects/[key]/list">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const tasks = await listProjectTasks(org.id, project.id);
  return (
    <main className="px-4 py-4 lg:px-8">
      <TaskList tasks={tasks} />
    </main>
  );
}
