import "server-only";
import { listComments } from "@/features/issues/queries";
import { getTaskByKey, listLabels, listMilestones, type TaskRow } from "./queries";

/**
 * Data for a project page: its milestones and the org's labels (small), plus —
 * only when a task is open — that task's detail and latest comments.
 */
export async function loadProjectExtras(orgId: string, projectId: string, tasks: TaskRow[], taskKey: string | null) {
  const [labels, milestones, task] = await Promise.all([
    listLabels(orgId),
    listMilestones(orgId, projectId),
    taskKey ? getTaskByKey(orgId, taskKey) : null,
  ]);
  const comments = task ? await listComments({ taskId: task.id }) : [];
  return {
    task,
    comments,
    milestones,
    extras: {
      labels,
      milestones: milestones.map((m) => ({ id: m.id, name: m.name })),
      projectTasks: tasks.map((t) => ({ id: t.id, key: t.key, title: t.title })),
    },
  };
}
