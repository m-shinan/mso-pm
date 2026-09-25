import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { listProjects } from "@/features/projects/queries";
import { requireOrg } from "@/features/org/queries";
import { InviteButton, MemberTable } from "@/features/team/components";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/[org]/team">) {
  const { org, ctx } = await requireOrg(params);
  const projects = await listProjects(org.id);
  const members = ctx.members.map((m) => ({
    ...m,
    projectNames: projects.filter((p) => p.memberIds.includes(m.id)).map((p) => p.name),
  }));
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Team" }]} actions={<InviteButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Team" eyebrow={`${members.length} ${members.length === 1 ? "member" : "members"} of ${org.name}`}>
          <span className="lg:hidden"><InviteButton /></span>
        </PageTitle>
        <MemberTable members={members} />
      </main>
    </>
  );
}
