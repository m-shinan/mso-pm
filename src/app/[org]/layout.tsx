import { notFound } from "next/navigation";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileBottomNav, MobileTopBar } from "@/components/shell/mobile-nav";
import { OrgProvider } from "@/components/shell/org-provider";
import { QuickCreate } from "@/components/shell/quick-create";
import { Sidebar } from "@/components/shell/sidebar";
import { getDashboard } from "@/features/dashboard/queries";
import { getOrg, getOrgContext, listMyOrgs } from "@/features/org/queries";

export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org: slug } = await params;
  const org = await getOrg(slug);
  // Not a member (or no such org). RLS returns nothing either way.
  if (!org) notFound();

  const [orgs, data] = await Promise.all([listMyOrgs(), getOrgContext(org.id)]);
  // Sidebar counts. In Supabase these come from the same dashboard_summary call.
  const summary = await getDashboard(org.id, data.currentUserId);

  const counts = {
    myTasks: summary.myWork.today.length + summary.myWork.upcoming.length,
    projects: data.projects.length,
    openIssues: summary.stats.openIssues,
    criticalIssues: summary.stats.criticalIssues,
  };

  return (
    <OrgProvider org={org} orgs={orgs} data={data}>
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
