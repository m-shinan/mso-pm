import { ActivityFeed } from "@/components/domain/activity-feed";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { listActivity } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ params }: PageProps<"/[org]/activity">) {
  const { org } = await requireOrg(params);
  // Latest 20; older pages load on demand (keyset pagination on created_at).
  const events = await listActivity(org.id, { limit: 20 });
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Activity" }]} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Activity" eyebrow={`Everything that changed in ${org.name}`} />
        <div className="max-w-2xl rounded-lg border border-line bg-surface px-4 py-2">
          {events.length ? <ActivityFeed events={events} /> : <p className="py-6 text-center text-sm text-ink-4">No activity yet. Changes to projects, tasks and issues appear here.</p>}
        </div>
      </main>
    </>
  );
}
