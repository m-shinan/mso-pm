import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { DocEditor, SecretsNote } from "@/features/docs/components";
import { getDocument } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";

export default async function DocPage({ params, searchParams }: PageProps<"/[org]/docs/[id]">) {
  const { id } = await params;
  const { org } = await requireOrg(params);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await getDocument(org.id, id);
  if (!doc) notFound();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        orgName={org.name}
        crumbs={[{ label: "Documents", href: `/${org.slug}/docs` }, { label: doc.project?.name ?? "Project" }, { label: doc.title }]}
      />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-7">
        <DocEditor key={doc.updated_at} doc={doc} startEditing={sp.edit === "1"} />
        <SecretsNote />
      </main>
    </>
  );
}
