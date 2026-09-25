import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export interface TaskRow extends Task {
  key: string;
  projectName: string;
}

// Columns the list and board need. Descriptions, comments and history load only when a task is opened.
const TASK_COLUMNS =
  "id, project_id, number, title, status_id, priority_id, assignee_id, due_date, blocked_reason, release_id, " +
  "project:projects(key, name), labels:task_labels(label:labels(name)), checklist:checklist_items(done)";

type TaskDb = {
  id: string; project_id: string; number: number; title: string; status_id: string; priority_id: string;
  assignee_id: string | null; due_date: string | null; blocked_reason: string | null; release_id: string | null;
  project: { key: string; name: string } | null;
  labels: { label: { name: string } | null }[];
  checklist: { done: boolean }[];
};

function toTask(t: TaskDb): TaskRow {
  return {
    id: t.id,
    projectId: t.project_id,
    number: t.number,
    title: t.title,
    statusId: t.status_id,
    priorityId: t.priority_id,
    assigneeId: t.assignee_id,
    dueDate: t.due_date,
    labels: t.labels.map((l) => l.label?.name).filter((x): x is string => Boolean(x)),
    checklist: t.checklist.length ? { done: t.checklist.filter((c) => c.done).length, total: t.checklist.length } : null,
    blockedReason: t.blocked_reason,
    releaseId: t.release_id,
    key: `${t.project?.key}-${t.number}`,
    projectName: t.project?.name ?? "",
  };
}

export async function listProjectTasks(orgId: string, projectId: string, opts: { releaseId?: string } = {}) {
  const supabase = await createClient();
  let q = supabase.from("tasks").select(TASK_COLUMNS).eq("organization_id", orgId).eq("project_id", projectId);
  if (opts.releaseId) q = q.eq("release_id", opts.releaseId);
  const { data, error } = await q.order("sort_order").order("number").limit(500);
  if (error) throw error;
  return ((data ?? []) as unknown as TaskDb[]).map(toTask);
}

/** Open tasks assigned to a user. `openStatusIds` = statuses whose category isn't completed. */
export async function listMyTasks(orgId: string, userId: string, openStatusIds: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("organization_id", orgId)
    .eq("assignee_id", userId)
    .in("status_id", openStatusIds)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as TaskDb[]).map(toTask);
}

/** Full task for the detail drawer, by key ("skr-142"). Loaded only when a task is opened. */
export async function getTaskByKey(orgId: string, key: string) {
  const m = /^([a-z][a-z0-9]{1,5})-(\d+)$/i.exec(key.trim());
  if (!m) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, project_id, number, title, description, status_id, priority_id, assignee_id, reporter_id, due_date, blocked_reason, created_at, updated_at, " +
        "project:projects!inner(key, name), checklist:checklist_items(id, body, done, sort_order)",
    )
    .eq("organization_id", orgId)
    .eq("number", Number(m[2]))
    .eq("project.key", m[1].toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const t = data as unknown as {
    id: string; project_id: string; number: number; title: string; description: string; status_id: string; priority_id: string;
    assignee_id: string | null; reporter_id: string | null; due_date: string | null; blocked_reason: string | null;
    created_at: string; updated_at: string; project: { key: string; name: string };
    checklist: { id: string; body: string; done: boolean; sort_order: number }[];
  };
  return { ...t, key: `${t.project.key}-${t.number}`, checklist: [...t.checklist].sort((a, b) => a.sort_order - b.sort_order) };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskByKey>>>;
