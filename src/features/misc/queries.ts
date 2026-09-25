import "server-only";
import { dataset } from "@/mock/store";

export async function listClients(orgId: string) {
  const { clients, projects } = dataset(orgId);
  return clients.map((c) => ({
    ...c,
    projects: projects
      .filter((p) => p.clientId === c.id)
      .map((p) => ({ id: p.id, key: p.key, name: p.name, typeId: p.typeId, statusId: p.statusId, dueDate: p.dueDate })),
  }));
}
export type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

export async function listActivity(orgId: string, opts: { projectId?: string; limit?: number } = {}) {
  const { activity } = dataset(orgId);
  return activity.filter((a) => !opts.projectId || a.projectId === opts.projectId).slice(0, opts.limit ?? 20);
}

export async function listDocuments(orgId: string, projectId?: string) {
  const { documents, projects } = dataset(orgId);
  return documents
    .filter((d) => !projectId || d.projectId === projectId)
    .map((d) => ({ ...d, projectName: projects.find((p) => p.id === d.projectId)!.name }));
}

export async function listMilestones(orgId: string) {
  const { milestones, projects } = dataset(orgId);
  return milestones.map((m) => ({ ...m, projectKey: projects.find((p) => p.id === m.projectId)!.key }));
}
