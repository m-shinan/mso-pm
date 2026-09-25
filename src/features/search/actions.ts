"use server";

import { getOrg } from "@/features/org/queries";
import { createClient } from "@/lib/supabase/server";

export interface SearchHit {
  group: "Projects" | "Tasks" | "Issues" | "Clients" | "Documents" | "People";
  id: string;
  key: string | null;
  title: string;
  meta: string;
  href: string;
}

/**
 * Org-scoped search: one `search_org` call over trigram indexes, top 5 per
 * type. The browser never downloads records to filter them itself.
 */
export async function searchOrg(orgSlug: string, query: string): Promise<SearchHit[]> {
  if (query.trim().length < 2) return [];
  const org = await getOrg(orgSlug);
  if (!org) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_org", { p_org: org.id, p_query: query });
  if (error) {
    console.error("[mso-pm] search", error);
    return [];
  }
  return ((data ?? []) as unknown as SearchHit[]).map((h) => ({ ...h, href: `/${org.slug}${h.href}` }));
}
