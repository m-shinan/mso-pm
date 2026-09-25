"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export interface NewTask {
  organizationId: string;
  projectId: string;
  title: string;
  description?: string;
  statusId: string;
  priorityId: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}

/** Insert a task. The number (SKR-###) is assigned by the database. */
export async function createTask(t: NewTask, reporterId: string) {
  return supabaseBrowser()
    .from("tasks")
    .insert({
      organization_id: t.organizationId,
      project_id: t.projectId,
      title: t.title.trim(),
      description: t.description?.trim() ?? "",
      status_id: t.statusId,
      priority_id: t.priorityId,
      assignee_id: t.assigneeId || null,
      due_date: t.dueDate || null,
      reporter_id: reporterId,
      number: 0, // replaced by the assign_item_number trigger
    })
    .select("id, number")
    .single();
}

export async function setTaskStatus(id: string, statusId: string) {
  return supabaseBrowser().from("tasks").update({ status_id: statusId }).eq("id", id).select("id").single();
}

export async function setTaskLabel(t: { organizationId: string; projectId: string; taskId: string }, labelId: string, on: boolean) {
  const db = supabaseBrowser().from("task_labels");
  return on
    ? db.insert({ task_id: t.taskId, label_id: labelId, project_id: t.projectId, organization_id: t.organizationId })
    : db.delete().eq("task_id", t.taskId).eq("label_id", labelId);
}

export async function addDependency(t: { organizationId: string; projectId: string; taskId: string }, blockedById: string) {
  return supabaseBrowser()
    .from("task_dependencies")
    .insert({ task_id: t.taskId, blocked_by_id: blockedById, project_id: t.projectId, organization_id: t.organizationId });
}

export async function removeDependency(taskId: string, blockedById: string) {
  return supabaseBrowser().from("task_dependencies").delete().eq("task_id", taskId).eq("blocked_by_id", blockedById);
}

export async function updateTask(id: string, patch: { title?: string; description?: string; assignee_id?: string | null; priority_id?: string; due_date?: string | null; blocked_reason?: string | null; milestone_id?: string | null }) {
  return supabaseBrowser().from("tasks").update(patch).eq("id", id).select("id").single();
}

export async function deleteTask(id: string) {
  return supabaseBrowser().from("tasks").delete().eq("id", id).select("id").single();
}

export async function toggleChecklistItem(id: string, done: boolean) {
  return supabaseBrowser().from("checklist_items").update({ done }).eq("id", id).select("id").single();
}

export async function addChecklistItem(item: { organizationId: string; projectId: string; taskId: string; body: string; sortOrder: number }) {
  return supabaseBrowser()
    .from("checklist_items")
    .insert({ organization_id: item.organizationId, project_id: item.projectId, task_id: item.taskId, body: item.body.trim(), sort_order: item.sortOrder })
    .select("id, body, done, sort_order")
    .single();
}
