import "server-only";
import { dataset } from "@/mock/store";
import { OPTIONS } from "@/mock/data";
import type { Issue } from "@/lib/types";

export interface IssueRow extends Issue {
  key: string;
  projectName: string;
  projectKey: string;
}

export async function listIssues(orgId: string, opts: { projectId?: string; state?: "open" | "resolved" | "all" } = {}) {
  const { issues, projects } = dataset(orgId);
  const state = opts.state ?? "open";
  const category = (statusId: string) => OPTIONS.find((o) => o.id === statusId)?.category;
  const rank = (id: string) => OPTIONS.find((o) => o.id === id)?.rank ?? 0;
  return issues
    .filter((i) => !opts.projectId || i.projectId === opts.projectId)
    .filter((i) => {
      const c = category(i.statusId);
      if (state === "open") return c === "open" || c === "active";
      if (state === "resolved") return c === "resolved" || c === "closed";
      return true;
    })
    .sort((a, b) => rank(b.severityId) - rank(a.severityId) || b.createdAt.localeCompare(a.createdAt))
    .map<IssueRow>((i) => {
      const p = projects.find((x) => x.id === i.projectId)!;
      return { ...i, key: `${p.key}-${i.number}`, projectName: p.name, projectKey: p.key };
    });
}

export async function getIssue(orgId: string, key: string) {
  const all = await listIssues(orgId, { state: "all" });
  return all.find((i) => i.key.toLowerCase() === key.toLowerCase()) ?? null;
}
