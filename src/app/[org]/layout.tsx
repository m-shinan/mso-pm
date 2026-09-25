import { notFound, redirect } from "next/navigation";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileBottomNav, MobileTopBar } from "@/components/shell/mobile-nav";
import { OrgProvider } from "@/components/shell/org-provider";
import { QuickCreate } from "@/components/shell/quick-create";
import { Sidebar } from "@/components/shell/sidebar";
import { getDashboard } from "@/features/dashboard/queries";
import { listNotifications } from "@/features/misc/queries";
import { getOrg, getOrgContext, listMyOrgs } from "@/features/org/queries";
import { getUserId } from "@/lib/supabase/server";

export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  if (!(await getUserId())) redirect("/login");
  const { org: slug } = await params;
  const org = await getOrg(slug);
  // Not a member, removed, or no such org: RLS returns nothing either way.
  if (!org) {
    const orgs = await listMyOrgs();
    if (orgs.length === 0) redirect("/onboarding");
    notFound();
  }

  const [orgs, data, summary, notifications] = await Promise.all([
    listMyOrgs(),
    getOrgContext(org.id),
    getDashboard(org.id),
    listNotifications(org.id),
  ]);

  const counts = {
    myTasks: summary.myWork.today.length + summary.myWork.upcoming.length,
    projects: data.projects.length,
    openIssues: summary.stats.openIssues,
    criticalIssues: summary.stats.criticalIssues,
  };

  return (
    <OrgProvider org={org} orgs={orgs} data={data} notifications={notifications}>
      <div className="flex min-h-dvh">
        <Sidebar counts={counts} />
        <div className="flex min-w-0 grow flex-col pb-[calc(env(safe-area-inset-bottom)+72px)] lg:pb-0">
          <MobileTopBar />
          {children}
        </div>
      </div>
      <MobileBottomNav />
      <CommandPalette />
      <QuickCreate />
    </OrgProvider>
  );
}
