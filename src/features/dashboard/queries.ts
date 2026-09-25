import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

interface WorkItem {
  id: string;
  key: string;
  title: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  dueDate: string | null;
  projectId: string;
  projectName: string;
}

export interface DashboardData {
  stats: {
    activeProjects: number;
    dueToday: number;
    overdue: number;
    oldestOverdueDays: number;
    openIssues: number;
    criticalIssues: number;
    blocked: number;
  };
  attention: {
    id: string;
    kind: "issue" | "task" | "project";
    title: string;
    key: string;
    project: string;
    reason: string;
    tone: "danger" | "warn" | "neutral";
    statusId?: string;
    severityId?: string;
    personId: string | null;
  }[];
  myWork: { today: WorkItem[]; upcoming: WorkItem[]; blocked: WorkItem[] };
  deadlines: { id: string; date: string; title: string; kind: string }[];
  projects: {
    id: string;
    key: string;
    name: string;
    typeId: string;
    statusId: string;
    dueDate: string | null;
    updatedAt: string;
    tasksDone: number;
    tasksTotal: number;
    memberIds: string[];
  }[];
}

/**
 * Everything the dashboard shows, in one call. `dashboard_summary` aggregates
 * in Postgres (security invoker, so RLS applies) and returns only counts and
 * short lists — never the underlying rows.
 */
export const getDashboard = cache(async (orgId: string): Promise<DashboardData> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", { p_org: orgId });
  if (error) throw error;
  return data as unknown as DashboardData;
});
