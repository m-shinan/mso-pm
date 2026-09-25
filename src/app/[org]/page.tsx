import Link from "next/link";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { NewTaskButton } from "@/components/shell/quick-create";
import { Section } from "@/components/ui/section";
import { getDashboard } from "@/features/dashboard/queries";
import { AttentionList, Deadlines, MyWork, ProjectsTable, StatStrip } from "@/features/dashboard/components";
import { listActivity } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";
import { formatToday } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/[org]">) {
  const { org } = await requireOrg(params);
  // Same cached call as the layout's — one RPC per request.
  const [data, activity] = await Promise.all([getDashboard(org.id), listActivity(org.id, { limit: 5 })]);

  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Dashboard" }]} actions={<NewTaskButton />} />
      <main className="flex flex-col gap-5 px-4 py-5 lg:gap-6 lg:px-8 lg:py-7">
        <PageTitle title={<><span className="lg:hidden">Today</span><span className="max-lg:hidden">Dashboard</span></>} eyebrow={formatToday()} />
        <StatStrip stats={data.stats} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <AttentionList items={data.attention} />
            <MyWork work={data.myWork} />
          </div>
          <div className="flex flex-col gap-5 lg:gap-6">
            <Deadlines items={data.deadlines} />
            <Section
              title="Recent activity"
              action={<Link href={`/${org.slug}/activity`} className="text-sm text-accent hover:text-accent-hover">All activity</Link>}
            >
              <div className="px-4 pb-3">
                {activity.length ? <ActivityFeed events={activity} /> : <p className="py-4 text-center text-sm text-ink-4">No activity yet.</p>}
              </div>
            </Section>
          </div>
        </div>
        <ProjectsTable projects={data.projects} />
      </main>
    </>
  );
}
