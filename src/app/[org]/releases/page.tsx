import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { requireOrg } from "@/features/org/queries";
import { NewReleaseButton, ReleasesView } from "@/features/releases/components";
import { listReleases } from "@/features/releases/queries";
import { listProjectTasks } from "@/features/tasks/queries";

export const metadata = { title: "Releases" };

export default async function ReleasesPage({ params, searchParams }: PageProps<"/[org]/releases">) {
  const { org, ctx } = await requireOrg(params);
  const sp = await searchParams;
  const releases = await listReleases(org.id, ctx.options);
  const selected = releases.find((r) => r.id === sp.release) ?? null;
  const tasks = selected ? await listProjectTasks(org.id, selected.projectId, { releaseId: selected.id }) : [];
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Releases" }]} actions={<NewReleaseButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Releases"><span className="lg:hidden"><NewReleaseButton /></span></PageTitle>
        <ReleasesView releases={releases} selected={selected} tasks={tasks} />
      </main>
    </>
  );
}
