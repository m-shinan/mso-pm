import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { ClientDrawer, ClientList } from "@/features/clients/components";
import { listClients } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ params, searchParams }: PageProps<"/[org]/clients">) {
  const { org } = await requireOrg(params);
  const sp = await searchParams;
  const clients = await listClients(org.id);
  const selected = clients.find((c) => c.id === sp.client) ?? null;
  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Clients" }]} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Clients" eyebrow={`${clients.length} in ${org.name}`} />
        <ClientList clients={clients} selectedId={selected?.id ?? null} />
      </main>
      <ClientDrawer client={selected} />
    </>
  );
}
