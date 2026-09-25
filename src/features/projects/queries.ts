import "server-only";
import { dataset } from "@/mock/store";

export async function listProjects(orgId: string) {
  const { projects, clients } = dataset(orgId);
  return projects.map((p) => ({
    ...p,
    clientName: clients.find((c) => c.id === p.clientId)?.name ?? null,
  }));
}

export async function getProjectByKey(orgId: string, key: string) {
  const { projects, clients } = dataset(orgId);
  const p = projects.find((x) => x.key.toLowerCase() === key.toLowerCase());
  if (!p) return null;
  return { ...p, client: clients.find((c) => c.id === p.clientId) ?? null };
}

export type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
