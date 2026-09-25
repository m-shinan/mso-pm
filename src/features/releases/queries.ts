import "server-only";
import { dataset } from "@/mock/store";
import { OPTIONS } from "@/mock/data";

export async function listReleases(orgId: string, projectId?: string) {
  const { releases, projects, tasks, issues } = dataset(orgId);
  const doneIds = new Set(OPTIONS.filter((o) => o.category === "completed").map((o) => o.id));
  const rows = releases
    .filter((r) => !projectId || r.projectId === projectId)
    .map((r) => {
      const project = projects.find((p) => p.id === r.projectId)!;
      const items = tasks.filter((t) => t.releaseId === r.id);
      return {
        ...r,
        projectName: project.name,
        projectKey: project.key,
        released: OPTIONS.find((o) => o.id === r.statusId)?.category === "released",
        // In the database these counts come from one aggregate query, not raw rows.
        tasksDone: items.filter((t) => doneIds.has(t.statusId)).length,
        tasksTotal: items.length,
        openIssues: issues.filter((i) => i.releaseId === r.id).length,
      };
    });
  const upcoming = rows.filter((r) => !r.released).sort((a, b) => (a.releaseDate ?? "9").localeCompare(b.releaseDate ?? "9"));
  const released = rows.filter((r) => r.released).sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  return [...upcoming, ...released];
}

export type ReleaseRow = Awaited<ReturnType<typeof listReleases>>[number];
