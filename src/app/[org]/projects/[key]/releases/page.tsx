import { notFound } from "next/navigation";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";
import { ReleasesView } from "@/features/releases/components";
import { listReleases } from "@/features/releases/queries";
import { listProjectTasks } from "@/features/tasks/queries";

export default async function ProjectReleasesPage({ params, searchParams }: PageProps<"/[org]/projects/[key]/releases">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const sp = await searchParams;
  const releases = await listReleases(org.id, project.id);
  const selected = releases.find((r) => r.id === sp.release) ?? null;
  const tasks = selected ? (await listProjectTasks(org.id, project.id)).filter((t) => t.releaseId === selected.id) : [];
  return (
    <main className="px-4 py-4 lg:px-8">
      <ReleasesView releases={releases} selected={selected} tasks={tasks} />
    </main>
  );
}
