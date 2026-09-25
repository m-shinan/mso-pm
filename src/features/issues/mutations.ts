"use client";

import { supabaseBrowser } from "@/lib/supabase/client";

export interface NewIssue {
  organizationId: string;
  projectId: string;
  title: string;
  statusId: string;
  severityId: string;
  priorityId: string;
  assigneeId?: string | null;
  environment?: string;
  steps?: string[];
  expected?: string;
  actual?: string;
}

export async function createIssue(i: NewIssue, reporterId: string) {
  return supabaseBrowser()
    .from("issues")
    .insert({
      organization_id: i.organizationId,
      project_id: i.projectId,
      title: i.title.trim(),
      status_id: i.statusId,
      severity_id: i.severityId,
      priority_id: i.priorityId,
      assignee_id: i.assigneeId || null,
      environment: i.environment?.trim() ?? "",
      steps: (i.steps ?? []).map((s) => s.trim()).filter(Boolean),
      expected: i.expected?.trim() ?? "",
      actual: i.actual?.trim() ?? "",
      reporter_id: reporterId,
      number: 0, // replaced by the assign_item_number trigger
    })
    .select("id, number, project:projects(key)")
    .single();
}

export async function setIssueStatus(id: string, statusId: string) {
  return supabaseBrowser().from("issues").update({ status_id: statusId }).eq("id", id).select("id").single();
}

export async function addComment(c: { organizationId: string; projectId: string; issueId?: string; taskId?: string; body: string }, authorId: string) {
  return supabaseBrowser()
    .from("comments")
    .insert({
      organization_id: c.organizationId,
      project_id: c.projectId,
      issue_id: c.issueId ?? null,
      task_id: c.taskId ?? null,
      body: c.body.trim(),
      author_id: authorId,
    })
    .select("id, author_id, body, created_at, edited_at")
    .single();
}

export async function deleteComment(id: string) {
  return supabaseBrowser().from("comments").delete().eq("id", id).select("id").single();
}
