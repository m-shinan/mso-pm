import "server-only";
import { cache } from "react";
import { createClient, getUserId } from "@/lib/supabase/server";
import type { Client, Project } from "@/lib/types";

const PROJECT_COLUMNS =
  "id, key, name, description, client_id, type_id, status_id, priority_id, start_date, due_date, updated_at, repo_url, prod_url, staging_url, client:clients(name), members:project_members(user_id)";

type ProjectRowDb = {
  id: string; key: string; name: string; description: string; client_id: string | null; type_id: string; status_id: string;
  priority_id: string; start_date: string | null; due_date: string | null; updated_at: string;
  repo_url: string | null; prod_url: string | null; staging_url: string | null;
  client: { name: string } | null; members: { user_id: string }[];
};

async function progressFor(projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, { done: number; total: number }>();
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_progress").select("project_id, done, total").in("project_id", projectIds);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.project_id!, { done: r.done ?? 0, total: r.total ?? 0 }]));
}

async function pinsFor(orgId: string) {
  const supabase = await createClient();
  const userId = await getUserId();
  const { data } = await supabase.from("project_pins").select("project_id").eq("organization_id", orgId).eq("user_id", userId!);
  return new Set((data ?? []).map((p) => p.project_id));
}

function toProject(p: ProjectRowDb, progress: Map<string, { done: number; total: number }>, pins: Set<string>) {
  const pr = progress.get(p.id) ?? { done: 0, total: 0 };
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    clientId: p.client_id,
    typeId: p.type_id,
    statusId: p.status_id,
    priorityId: p.priority_id,
    startDate: p.start_date,
    dueDate: p.due_date,
    tasksDone: pr.done,
    tasksTotal: pr.total,
    memberIds: p.members.map((m) => m.user_id),
    updatedAt: p.updated_at,
    pinned: pins.has(p.id),
    clientName: p.client?.name ?? null,
    links: { repo: p.repo_url, prod: p.prod_url, staging: p.staging_url },
  } satisfies Project & Record<string, unknown>;
}

export async function listProjects(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ProjectRowDb[];
  const [progress, pins] = await Promise.all([progressFor(rows.map((r) => r.id)), pinsFor(orgId)]);
  return rows.map((r) => toProject(r, progress, pins));
}

export const getProjectByKey = cache(async (orgId: string, key: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`${PROJECT_COLUMNS}, archived_at, clientRow:clients(id, name, industry, contact_name, contact_role, email, phone, notes, updated_at)`)
    .eq("organization_id", orgId)
    .eq("key", key.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as ProjectRowDb & {
    archived_at: string | null;
    clientRow: { id: string; name: string; industry: string; contact_name: string; contact_role: string; email: string | null; phone: string | null; notes: string; updated_at: string } | null;
  };
  const [progress, pins] = await Promise.all([progressFor([row.id]), pinsFor(orgId)]);
  const c = row.clientRow;
  const client: Client | null = c
    ? { id: c.id, name: c.name, industry: c.industry, contactName: c.contact_name, contactRole: c.contact_role || null, email: c.email, phone: c.phone, notes: c.notes || null, lastActivity: c.updated_at }
    : null;
  return { ...toProject(row, progress, pins), archivedAt: row.archived_at, client };
});

export type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProjectByKey>>>;
