import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Issue, Option } from "@/lib/types";

export interface IssueRow extends Issue {
  key: string;
  projectName: string;
  projectKey: string;
}

const ISSUE_COLUMNS =
  "id, project_id, number, title, status_id, severity_id, priority_id, assignee_id, reporter_id, environment, steps, expected, actual, related_task_id, release_id, created_at, project:projects!inner(key, name)";

type IssueDb = {
  id: string; project_id: string; number: number; title: string; status_id: string; severity_id: string; priority_id: string;
  assignee_id: string | null; reporter_id: string | null; environment: string; steps: string[]; expected: string; actual: string;
  related_task_id: string | null; release_id: string | null; created_at: string; project: { key: string; name: string };
};

function toIssue(i: IssueDb): IssueRow {
  return {
    id: i.id,
    projectId: i.project_id,
    number: i.number,
    title: i.title,
    statusId: i.status_id,
    severityId: i.severity_id,
    priorityId: i.priority_id,
    assigneeId: i.assignee_id,
    reporterId: i.reporter_id ?? "",
    environment: i.environment,
    steps: i.steps,
    expected: i.expected,
    actual: i.actual,
    relatedTaskId: i.related_task_id,
    releaseId: i.release_id,
    createdAt: i.created_at,
    key: `${i.project.key}-${i.number}`,
    projectName: i.project.name,
    projectKey: i.project.key,
  };
}

/**
 * Issues in an org, most severe first. `options` (from the org context) turns
 * the open/resolved filter into status ids so it runs in the database.
 */
export async function listIssues(
  orgId: string,
  options: Option[],
  opts: { projectId?: string; state?: "open" | "resolved" | "all" } = {},
) {
  const state = opts.state ?? "open";
  const statusIds = options
    .filter((o) => o.kind === "issue_status")
    .filter((o) => (state === "open" ? ["open", "active"].includes(o.category ?? "") : state === "resolved" ? ["resolved", "closed"].includes(o.category ?? "") : true))
    .map((o) => o.id);
  const supabase = await createClient();
  let q = supabase.from("issues").select(ISSUE_COLUMNS).eq("organization_id", orgId).in("status_id", statusIds);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const rank = new Map(options.map((o) => [o.id, o.rank ?? 0]));
  return ((data ?? []) as unknown as IssueDb[])
    .map(toIssue)
    .sort((a, b) => (rank.get(b.severityId) ?? 0) - (rank.get(a.severityId) ?? 0) || b.createdAt.localeCompare(a.createdAt));
}

/** One issue by its key, e.g. "skr-88". */
export async function getIssue(orgId: string, key: string) {
  const m = /^([a-z][a-z0-9]{1,5})-(\d+)$/i.exec(key.trim());
  if (!m) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .eq("organization_id", orgId)
    .eq("number", Number(m[2]))
    .eq("project.key", m[1].toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data ? toIssue(data as unknown as IssueDb) : null;
}

/** Latest comments on an issue or task (newest 20, shown oldest-first). */
export async function listComments(target: { issueId?: string; taskId?: string }) {
  const supabase = await createClient();
  let q = supabase.from("comments").select("id, author_id, body, created_at, edited_at");
  q = target.issueId ? q.eq("issue_id", target.issueId) : q.eq("task_id", target.taskId!);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []).reverse();
}

export type CommentRow = Awaited<ReturnType<typeof listComments>>[number];
