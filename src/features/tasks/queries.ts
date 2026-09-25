import "server-only";
import { dataset } from "@/mock/store";
import type { Task } from "@/lib/types";

export interface TaskRow extends Task {
  key: string;
  projectName: string;
}

function withKeys(orgId: string, tasks: Task[]): TaskRow[] {
  const { projects } = dataset(orgId);
  return tasks.map((t) => {
    const p = projects.find((x) => x.id === t.projectId)!;
    return { ...t, key: `${p.key}-${t.number}`, projectName: p.name };
  });
}

export async function listProjectTasks(orgId: string, projectId: string) {
  return withKeys(orgId, dataset(orgId).tasks.filter((t) => t.projectId === projectId));
}

export async function listMyTasks(orgId: string, userId: string) {
  return withKeys(orgId, dataset(orgId).tasks.filter((t) => t.assigneeId === userId));
}
