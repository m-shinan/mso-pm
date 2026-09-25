import type { ActivityEvent } from "./types";

type Changes = Record<string, unknown>;

interface ActivityRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_label: string;
  changes: unknown;
  project_id: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = { status: "status", assignee: "assignee", due_date: "due date", priority: "priority", title: "title", severity: "severity", name: "name" };

function pair(v: unknown): [unknown, unknown] | null {
  return Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null;
}

/** Turn an activity row into "moved SKR-144 to Blocked"-style parts. */
export function describeActivity(row: ActivityRow): ActivityEvent {
  const ch = (row.changes ?? {}) as Changes;
  const base = { id: String(row.id), actorId: row.actor_id ?? "", projectId: row.project_id, at: row.created_at, subject: row.entity_label };
  const noun = row.entity_type === "issue" ? "issue" : row.entity_type === "release" ? "release" : row.entity_type;

  switch (row.action) {
    case "created":
      return { ...base, verb: `created ${noun === "project" ? "project" : ""}`.trim(), detail: typeof ch.title === "string" ? ch.title : "" };
    case "reported":
      return { ...base, verb: "reported", detail: `${ch.title ?? ""}${ch.severity ? ` (${ch.severity})` : ""}` };
    case "commented":
      return { ...base, verb: "commented on", detail: typeof ch.excerpt === "string" ? `“${ch.excerpt}”` : "" };
    case "released":
      return { ...base, verb: "released", detail: "" };
    case "archived":
    case "restored":
      return { ...base, verb: row.action, detail: "" };
    case "member_added":
      return { ...base, verb: "added", detail: `to ${ch.project ?? "a project"}` };
    case "member_removed":
      return { ...base, verb: "removed", detail: `from ${ch.project ?? "a project"}` };
    case "deleted":
      return { ...base, verb: "deleted", detail: typeof ch.title === "string" ? ch.title : "" };
  }

  // updated / completed / resolved / reopened: describe the most important change.
  const status = pair(ch.status);
  if (status) return { ...base, verb: "moved", detail: `to ${status[1]}` };
  const assignee = pair(ch.assignee);
  if (assignee) return { ...base, verb: assignee[1] ? "assigned" : "unassigned", detail: assignee[1] ? `to ${assignee[1]}` : "" };
  const due = pair(ch.due_date);
  if (due) return { ...base, verb: "changed the due date of", detail: due[1] ? `to ${due[1]}` : "(removed)" };
  const key = Object.keys(ch)[0];
  const v = key ? pair(ch[key]) : null;
  return { ...base, verb: `changed the ${FIELD_LABELS[key ?? ""] ?? "details"} of`, detail: v?.[1] ? `to ${v[1]}` : "" };
}
