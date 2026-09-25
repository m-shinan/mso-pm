import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CURRENT_USER_ID, OPTIONS, ORGS } from "@/mock/data";
import { dataset } from "@/mock/store";
import { permissionsFor } from "@/lib/permissions";
import type { Option, OptionKind } from "@/lib/types";

/** Organizations the current user belongs to. Becomes a join on organization_members. */
export const listMyOrgs = cache(async () => ORGS);

/** Resolve the org in the URL. Null = not a member (the layout then 404s). */
export const getOrg = cache(async (slug: string) => ORGS.find((o) => o.slug === slug) ?? null);

/**
 * Everything a page in an org needs once: options, members, my permissions.
 * One request per org, cached for the render and on the client (egress rule §7).
 */
export const getOrgContext = cache(async (orgId: string) => {
  const org = ORGS.find((o) => o.id === orgId)!;
  const { members, projects } = dataset(orgId);
  return {
    options: OPTIONS.filter((o) => o.isActive),
    members,
    projects: projects.map((p) => ({ id: p.id, key: p.key, name: p.name, typeId: p.typeId, pinned: p.pinned })),
    permissions: permissionsFor(org.role),
    currentUserId: CURRENT_USER_ID,
  };
});

export type OrgContextData = Awaited<ReturnType<typeof getOrgContext>>;

/** For pages: resolve the org from route params or 404. */
export async function requireOrg(params: Promise<{ org: string }>) {
  const { org: slug } = await params;
  const org = await getOrg(slug);
  if (!org) notFound();
  return { org, ctx: await getOrgContext(org.id) };
}

export async function listOptions(orgId: string, kind: OptionKind): Promise<Option[]> {
  const { options } = await getOrgContext(orgId);
  return options.filter((o) => o.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder);
}
