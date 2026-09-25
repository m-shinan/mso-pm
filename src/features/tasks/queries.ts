import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export interface TaskRow extends Task {
  key: string;
  projectName: string;
}

// Columns the list and board need. Descriptions, comments and history load only when a task is opened.
const TASK_COLUMNS =
  "id, project_id, number, title, status_id, priority_id, assignee_id, due_date, blocked_reason, release_id, milestone_id, " +
  "project:projects(key, name), labels:task_labels(label:labels(name)), checklist:checklist_items(done), " +
  "deps:task_dependencies!task_dependencies_project_id_task_id_fkey(blocked_by_id)";

type TaskDb = {
  id: string; project_id: string; number: number; title: string; status_id: string; priority_id: string;
  assignee_id: string | null; due_date: string | null; blocked_reason: string | null; release_id: string | null;
  milestone_id: string | null;
  project: { key: string; name: string } | null;
  labels: { label: { name: string } | null }[];
  checklist: { done: boolean }[];
  deps: { blocked_by_id: string }[];
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
    milestoneId: t.milestone_id,
    blockedByIds: t.deps.map((d) => d.blocked_by_id),
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
      "id, project_id, number, title, description, status_id, priority_id, assignee_id, reporter_id, due_date, blocked_reason, milestone_id, created_at, updated_at, " +
        "project:projects!inner(key, name), checklist:checklist_items(id, body, done, sort_order), labels:task_labels(label_id), " +
        "deps:task_dependencies!task_dependencies_project_id_task_id_fkey(blocked_by:tasks!task_dependencies_project_id_blocked_by_id_fkey(id, number, title, status_id)), " +
        "attachments(id, name, size_bytes, mime_type, storage_path, uploaded_by, created_at)",
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
    milestone_id: string | null; created_at: string; updated_at: string; project: { key: string; name: string };
    checklist: { id: string; body: string; done: boolean; sort_order: number }[];
    labels: { label_id: string }[];
    deps: { blocked_by: { id: string; number: number; title: string; status_id: string } | null }[];
    attachments: AttachmentRow[];
  };
  return {
    ...t,
    key: `${t.project.key}-${t.number}`,
    checklist: [...t.checklist].sort((a, b) => a.sort_order - b.sort_order),
    labelIds: t.labels.map((l) => l.label_id),
    blockedBy: t.deps
      .map((d) => d.blocked_by)
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({ ...b, key: `${t.project.key}-${b.number}` })),
    attachments: [...t.attachments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export interface AttachmentRow {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

/** Org labels (active first) and a project's milestones with progress — for pickers and filters. */
export async function listLabels(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("labels").select("id, name, color, is_active").eq("organization_id", orgId).order("name");
  if (error) throw error;
  return data ?? [];
}
export type LabelRow = Awaited<ReturnType<typeof listLabels>>[number];

export async function listMilestones(orgId: string, projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, name, description, start_date, due_date, tasks(status_id)")
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string; name: string; description: string; start_date: string | null; due_date: string | null; tasks: { status_id: string }[];
  }[];
}
export type MilestoneRow = Awaited<ReturnType<typeof listMilestones>>[number];

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskByKey>>>;
