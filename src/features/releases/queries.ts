import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Option, Release } from "@/lib/types";

type Changelog = Release["changelog"];

export async function listReleases(orgId: string, options: Option[], projectId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("releases")
    .select("id, project_id, version, name, status_id, release_date, released_at, changelog, project:projects(key, name)")
    .eq("organization_id", orgId);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q.order("release_date", { ascending: true, nullsFirst: false }).limit(100);
  if (error) throw error;
  const releases = data ?? [];
  const ids = releases.map((r) => r.id);

  // Counts per release: two narrow queries (release_id + status only), no task bodies.
  const [tasks, issues] = ids.length
    ? await Promise.all([
        supabase.from("tasks").select("release_id, status_id").in("release_id", ids),
        supabase.from("issues").select("release_id, status_id").in("release_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const cat = new Map(options.map((o) => [o.id, o.category]));

  const rows = releases.map((r) => {
    const items = (tasks.data ?? []).filter((t) => t.release_id === r.id);
    const cl = (r.changelog ?? {}) as Partial<Changelog>;
    return {
      id: r.id,
      projectId: r.project_id,
      version: r.version,
      name: r.name,
      statusId: r.status_id,
      releaseDate: r.release_date,
      changelog: { added: cl.added ?? [], changed: cl.changed ?? [], fixed: cl.fixed ?? [] },
      projectName: r.project?.name ?? "",
      projectKey: r.project?.key ?? "",
      released: cat.get(r.status_id) === "released",
      tasksDone: items.filter((t) => cat.get(t.status_id) === "completed").length,
      tasksTotal: items.length,
      openIssues: (issues.data ?? []).filter((i) => i.release_id === r.id && ["open", "active"].includes(cat.get(i.status_id) ?? "")).length,
    };
  });
  const upcoming = rows.filter((r) => !r.released);
  const released = rows.filter((r) => r.released).sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  return [...upcoming, ...released];
}

export type ReleaseRow = Awaited<ReturnType<typeof listReleases>>[number];
