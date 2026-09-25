import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/states";
import { NewDocButton, SecretsNote } from "@/features/docs/components";
import { listDocuments } from "@/features/misc/queries";
import { requireOrg } from "@/features/org/queries";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Documents" };

export default async function DocsPage({ params }: PageProps<"/[org]/docs">) {
  const { org, ctx } = await requireOrg(params);
  const docs = await listDocuments(org.id);
  const byProject = new Map<string, typeof docs>();
  for (const d of docs) byProject.set(d.projectName, [...(byProject.get(d.projectName) ?? []), d]);
  const name = (id: string) => ctx.members.find((m) => m.id === id)?.name ?? "Someone";

  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Documents" }]} actions={<NewDocButton />} />
      <main className="flex flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        <PageTitle title="Documents" eyebrow="Requirements, setup and deployment notes, decisions, important URLs">
          <span className="lg:hidden"><NewDocButton /></span>
        </PageTitle>
        <SecretsNote />
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" action={<NewDocButton />}>
            Write setup steps, deployment notes or client requirements for a project.
          </EmptyState>
        ) : (
          [...byProject.entries()].map(([project, list]) => (
            <Section key={project} id={`docs-${list[0].projectId}`} title={project} count={list.length} className="max-w-3xl">
              {list.map((d) => (
                <Link key={d.id} href={`/${org.slug}/docs/${d.id}`} className="flex min-h-12 items-center gap-3 border-t border-line-soft px-4 py-3 hover:bg-sunken">
                  <FileText aria-hidden className="size-4 shrink-0 text-ink-4" />
                  <span className="grow font-medium">{d.title}</span>
                  <span suppressHydrationWarning className="text-xs text-ink-4">{d.updatedBy ? `${name(d.updatedBy)} · ` : ""}{timeAgo(d.updatedAt)}</span>
                </Link>
              ))}
            </Section>
          ))
        )}
      </main>
    </>
  );
}
