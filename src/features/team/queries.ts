import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Roles for pickers (the owner role is never offered). */
export async function listRoles(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, permissions, is_system")
    .eq("organization_id", orgId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
export type RoleRow = Awaited<ReturnType<typeof listRoles>>[number];

/** Pending invitations — visible only to people who can invite (RLS). */
export async function listPendingInvitations(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, expires_at, created_at, role:roles(name)")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export type InvitationRow = Awaited<ReturnType<typeof listPendingInvitations>>[number];

/** Which projects each member belongs to (names only). */
export async function listProjectMemberships(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id, project:projects(name)")
    .eq("organization_id", orgId);
  if (error) throw error;
  const byUser = new Map<string, string[]>();
  for (const r of data ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.project?.name ?? ""]);
  return byUser;
}
