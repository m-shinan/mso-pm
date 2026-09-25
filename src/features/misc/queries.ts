import "server-only";
import { describeActivity } from "@/lib/activity";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent } from "@/lib/types";

export async function listClients(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, industry, contact_name, contact_role, email, phone, notes, updated_at, projects(id, key, name, type_id, status_id, due_date, archived_at)")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("name")
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    contactName: c.contact_name,
    contactRole: c.contact_role || null,
    email: c.email,
    phone: c.phone,
    notes: c.notes || null,
    lastActivity: c.updated_at,
    projects: (c.projects ?? [])
      .filter((p) => !p.archived_at)
      .map((p) => ({ id: p.id, key: p.key, name: p.name, typeId: p.type_id, statusId: p.status_id, dueDate: p.due_date })),
  }));
}
export type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

/** Latest activity; `before` (an activity id) pages further back. */
export async function listActivity(orgId: string, opts: { projectId?: string; limit?: number; before?: number } = {}): Promise<ActivityEvent[]> {
  const supabase = await createClient();
  let q = supabase
    .from("activity")
    .select("id, actor_id, action, entity_type, entity_label, changes, project_id, created_at")
    .eq("organization_id", orgId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.before) q = q.lt("id", opts.before);
  const { data, error } = await q.order("id", { ascending: false }).limit(opts.limit ?? 20);
  if (error) throw error;
  return (data ?? []).map(describeActivity);
}

export async function listDocuments(orgId: string, projectId?: string) {
  const supabase = await createClient();
  let q = supabase.from("documents").select("id, project_id, title, updated_by, updated_at, project:projects(name)").eq("organization_id", orgId);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    projectId: d.project_id,
    title: d.title,
    updatedBy: d.updated_by ?? "",
    updatedAt: d.updated_at,
    projectName: d.project?.name ?? "",
  }));
}

export async function getDocument(orgId: string, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, project_id, title, body, updated_by, updated_at, project:projects(key, name)")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Unread count + the latest few notifications for the bell. */
export async function listNotifications(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, href, read_at, created_at, actor_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  return data ?? [];
}
export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];
