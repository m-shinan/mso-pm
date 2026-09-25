import { PageHeader } from "@/components/shell/page-header";
import { requireOrg } from "@/features/org/queries";
import { SettingsNav } from "@/features/settings/settings-nav";

export const metadata = { title: "Settings" };

export default async function SettingsLayout({ children, params }: LayoutProps<"/[org]/settings">) {
  const { org } = await requireOrg(params);
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Settings" }]} />
      <div className="flex grow flex-col lg:flex-row">
        <SettingsNav />
        <main className="min-w-0 grow px-4 py-5 lg:max-w-[900px] lg:px-10 lg:py-7">{children}</main>
      </div>
    </>
  );
}
