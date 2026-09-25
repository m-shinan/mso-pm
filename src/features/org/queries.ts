import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { initialsOf, tintFor } from "@/lib/people";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Member, Option, OptionKind, Organization } from "@/lib/types";

/** Organizations the signed-in user is an active member of. */
export const listMyOrgs = cache(async (): Promise<Organization[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role:roles(key, name), org:organizations(id, slug, name, logo_color, timezone, week_start, members:organization_members(count))")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .filter((m) => m.org)
    .map((m) => ({
      id: m.org!.id,
      slug: m.org!.slug,
      name: m.org!.name,
      logoColor: m.org!.logo_color,
      timezone: m.org!.timezone,
      weekStart: m.org!.week_start,
      role: m.role?.key ?? "viewer",
      roleName: m.role?.name ?? "Member",
      memberCount: (m.org!.members as unknown as { count: number }[])[0]?.count ?? 1,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

/** Resolve the org in the URL. Null when it doesn't exist or you aren't a member (RLS hides it either way). */
export const getOrg = cache(async (slug: string) => (await listMyOrgs()).find((o) => o.slug === slug) ?? null);

/**
 * Everything a page in an org needs once: options, members, projects list,
 * my permissions. Loaded in the org layout and handed to the client provider,
 * so pickers never refetch configuration (egress rule §7).
 */
export const getOrgContext = cache(async (orgId: string) => {
  const supabase = await createClient();
  const userId = (await getUserId())!;
  const [options, members, projects, pins, perms] = await Promise.all([
    supabase
      .from("options")
      .select("id, kind, name, color, category, rank, sort_order, is_default, is_active")
      .eq("organization_id", orgId)
      .order("sort_order"),
    supabase
      .from("organization_members")
      .select("user_id, status, joined_at, role:roles(id, key, name), profile:profiles(full_name, email)")
      .eq("organization_id", orgId),
    supabase.from("projects").select("id, key, name, type_id").eq("organization_id", orgId).is("archived_at", null).order("name"),
    supabase.from("project_pins").select("project_id").eq("organization_id", orgId).eq("user_id", userId),
    supabase.rpc("my_permissions", { p_org: orgId }),
  ]);
  for (const r of [options, members, projects, pins, perms]) if (r.error) throw r.error;

  const pinned = new Set((pins.data ?? []).map((p) => p.project_id));
  return {
    options: (options.data ?? []).map<Option>((o) => ({
      id: o.id,
      kind: o.kind as OptionKind,
      name: o.name,
      color: o.color,
      category: o.category,
      rank: o.rank,
      sortOrder: o.sort_order,
      isDefault: o.is_default,
      isActive: o.is_active,
    })),
    members: (members.data ?? [])
      .map<Member>((m) => {
        const name = m.profile?.full_name || m.profile?.email || "Member";
        return {
          id: m.user_id,
          name,
          initials: initialsOf(name),
          email: m.profile?.email ?? null,
          role: m.role?.key ?? "viewer",
          roleId: m.role?.id ?? "",
          roleName: m.role?.name ?? "Member",
          status: m.status as Member["status"],
          joinedAt: m.joined_at,
          tint: tintFor(m.user_id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    projects: (projects.data ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name, typeId: p.type_id, pinned: pinned.has(p.id) })),
    permissions: (perms.data ?? []) as string[],
    currentUserId: userId,
  };
});

export type OrgContextData = Awaited<ReturnType<typeof getOrgContext>>;

/** For pages: signed in, member of the org in the URL, or redirect/404. */
export async function requireOrg(params: Promise<{ org: string }>) {
  if (!(await getUserId())) redirect("/login");
  const { org: slug } = await params;
  const org = await getOrg(slug);
  if (!org) notFound();
  return { org, ctx: await getOrgContext(org.id) };
}

export async function listOptions(orgId: string, kind: OptionKind): Promise<Option[]> {
  const { options } = await getOrgContext(orgId);
  return options.filter((o) => o.kind === kind);
}
