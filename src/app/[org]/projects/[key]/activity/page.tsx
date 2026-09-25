import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { listActivity } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";
import { getProjectByKey } from "@/features/projects/queries";

export default async function ProjectActivityPage({ params }: PageProps<"/[org]/projects/[key]/activity">) {
  const { key } = await params;
  const { org } = await requireOrg(params);
  const project = await getProjectByKey(org.id, key);
  if (!project) notFound();
  const events = await listActivity(org.id, { projectId: project.id, limit: 20 });
  return (
    <main className="px-4 py-4 lg:px-8">
      <div className="max-w-2xl rounded-lg border border-line bg-surface px-4 py-2">
        {events.length ? <ActivityFeed events={events} /> : <p className="py-6 text-center text-sm text-ink-4">No activity yet.</p>}
      </div>
    </main>
  );
}
