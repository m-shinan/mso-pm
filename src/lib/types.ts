// Domain types. They mirror the planned database schema (docs/ARCHITECTURE.md §4)
// so the mock data layer can be swapped for Supabase queries without touching UI.

export type ISODate = string; // YYYY-MM-DD

export type OptionKind =
  | "project_type"
  | "project_status"
  | "task_status"
  | "task_priority"
  | "issue_status"
  | "issue_severity"
  | "release_status";

/** Meaning of a status, independent of the name an organization gives it. */
export type TaskStatusCategory = "not_started" | "active" | "blocked" | "completed";
export type IssueStatusCategory = "open" | "active" | "resolved" | "closed";
export type ProjectStatusCategory = "planned" | "active" | "paused" | "completed";
export type ReleaseStatusCategory = "planned" | "active" | "released";

export interface Option {
  id: string;
  kind: OptionKind;
  name: string;
  color: string;
  /** Status meaning (see *Category types). Null for types/priorities/severities. */
  category: string | null;
  /** Ordering weight for priorities and severities (1 = lowest). */
  rank: number | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  /** Number of records using this option. Only loaded on the settings screen. */
  usage?: number;
}

export type RoleKey = "owner" | "admin" | "project_manager" | "developer" | "viewer";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  logoColor: string;
  /** The current user's role in this organization. */
  role: RoleKey;
  memberCount: number;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  role: RoleKey;
  status: "active" | "invited" | "deactivated";
  lastActive: string | null;
  /** Avatar tint pair, picked deterministically from the id. */
  tint: { bg: string; fg: string };
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  contactName: string;
  contactRole: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  lastActivity: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  clientId: string | null;
  typeId: string;
  statusId: string;
  priorityId: string;
  startDate: ISODate | null;
  dueDate: ISODate | null;
  tasksDone: number;
  tasksTotal: number;
  memberIds: string[];
  updatedAt: string;
  pinned: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  number: number;
  title: string;
  statusId: string;
  priorityId: string;
  assigneeId: string | null;
  dueDate: ISODate | null;
  labels: string[];
  checklist: { done: number; total: number } | null;
  blockedReason: string | null;
  releaseId: string | null;
}

export interface Issue {
  id: string;
  projectId: string;
  number: number;
  title: string;
  statusId: string;
  severityId: string;
  priorityId: string;
  assigneeId: string | null;
  reporterId: string;
  environment: string;
  steps: string[];
  expected: string;
  actual: string;
  relatedTaskId: string | null;
  releaseId: string | null;
  createdAt: string;
}

export interface Release {
  id: string;
  projectId: string;
  version: string;
  name: string;
  statusId: string;
  releaseDate: ISODate | null;
  changelog: { added: string[]; changed: string[]; fixed: string[] };
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  dueDate: ISODate;
}

export interface ActivityEvent {
  id: string;
  actorId: string;
  verb: string;
  subject: string;
  detail: string;
  projectId: string | null;
  at: string;
}

export interface DocumentSummary {
  id: string;
  projectId: string;
  title: string;
  updatedBy: string;
  updatedAt: string;
}
