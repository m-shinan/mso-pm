"use server";

import { getOrg } from "@/features/org/queries";
import { dataset } from "@/mock/store";
import { OPTIONS } from "@/mock/data";

export interface SearchHit {
  group: "Projects" | "Tasks" | "Issues" | "Clients" | "Documents" | "People";
  id: string;
  key: string | null;
  title: string;
  meta: string;
  href: string;
}

const PER_GROUP = 5;

/**
 * Org-scoped search. Becomes one `search(org_id, q)` SQL function over trigram
 * indexes — the browser never downloads records to filter them itself.
 */
export async function searchOrg(orgSlug: string, query: string): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const org = await getOrg(orgSlug);
  if (!org) return [];
  const { projects, tasks, issues, clients, documents, members } = dataset(org.id);
  const base = `/${org.slug}`;
  const hit = (s: string) => s.toLowerCase().includes(q);
  const opt = (id: string) => OPTIONS.find((o) => o.id === id)?.name ?? "";
  const project = (id: string) => projects.find((p) => p.id === id)!;

  const out: SearchHit[] = [
    ...projects.filter((p) => hit(p.name) || hit(p.key)).slice(0, PER_GROUP).map<SearchHit>((p) => ({
      group: "Projects", id: p.id, key: null, title: p.name, meta: opt(p.typeId), href: `${base}/projects/${p.key.toLowerCase()}`,
    })),
    ...tasks.filter((t) => hit(t.title) || hit(`${project(t.projectId).key}-${t.number}`)).slice(0, PER_GROUP).map<SearchHit>((t) => ({
      group: "Tasks", id: t.id, key: `${project(t.projectId).key}-${t.number}`, title: t.title,
      meta: `${project(t.projectId).name} · ${opt(t.statusId)}`, href: `${base}/projects/${project(t.projectId).key.toLowerCase()}`,
    })),
    ...issues.filter((i) => hit(i.title) || hit(`${project(i.projectId).key}-${i.number}`)).slice(0, PER_GROUP).map<SearchHit>((i) => ({
      group: "Issues", id: i.id, key: `${project(i.projectId).key}-${i.number}`, title: i.title,
      meta: opt(i.severityId), href: `${base}/issues?issue=${project(i.projectId).key.toLowerCase()}-${i.number}`,
    })),
    ...clients.filter((c) => hit(c.name) || hit(c.contactName)).slice(0, PER_GROUP).map<SearchHit>((c) => ({
      group: "Clients", id: c.id, key: null, title: c.name, meta: c.industry, href: `${base}/clients?client=${c.id}`,
    })),
    ...documents.filter((d) => hit(d.title) || hit(project(d.projectId).name)).slice(0, PER_GROUP).map<SearchHit>((d) => ({
      group: "Documents", id: d.id, key: null, title: `${project(d.projectId).name} · ${d.title}`, meta: "Document", href: `${base}/docs`,
    })),
    ...members.filter((m) => hit(m.name)).slice(0, PER_GROUP).map<SearchHit>((m) => ({
      group: "People", id: m.id, key: null, title: m.name, meta: "Member", href: `${base}/team`,
    })),
  ];
  return out;
}
