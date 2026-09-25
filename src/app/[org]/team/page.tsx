import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { requireOrg } from "@/features/org/queries";
import { InviteButton, MemberTable, PendingInvites } from "@/features/team/components";
import { listPendingInvitations, listProjectMemberships, listRoles } from "@/features/team/queries";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/[org]/team">) {
  const { org, ctx } = await requireOrg(params);
  const canInvite = ctx.permissions.includes("members.invite");
  const [roles, memberships, invites] = await Promise.all([
    listRoles(org.id),
    listProjectMemberships(org.id),
    canInvite ? listPendingInvitations(org.id) : Promise.resolve([]),
  ]);
  const members = ctx.members.map((m) => ({ ...m, projectNames: memberships.get(m.id) ?? [] }));
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Team" }]} actions={<InviteButton roles={roles} />} />
      <main className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Team" eyebrow={`${members.length} ${members.length === 1 ? "member" : "members"} of ${org.name}`}>
          <span className="lg:hidden"><InviteButton roles={roles} /></span>
        </PageTitle>
        <MemberTable members={members} roles={roles} />
        <PendingInvites invites={invites} />
      </main>
    </>
  );
}
