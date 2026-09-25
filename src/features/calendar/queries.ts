import "server-only";
import { dataset } from "@/mock/store";
import { OPTIONS } from "@/mock/data";

export type CalendarKind = "task" | "deadline" | "milestone" | "release";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarKind;
  label: string;
  sub: string;
  late: boolean;
  statusId: string | null;
  href: string;
}

/**
 * Dated items in [from, to]. In Supabase: one RPC unioning the four sources,
 * filtered by date range in SQL, returning these few columns.
 */
export async function listCalendar(orgId: string, orgSlug: string, from: string, to: string): Promise<CalendarEvent[]> {
  const { tasks, projects, milestones, releases } = dataset(orgId);
  const today = new Date().toISOString().slice(0, 10);
  const inRange = (d: string | null): d is string => !!d && d >= from && d <= to;
  const project = (id: string) => projects.find((p) => p.id === id)!;
  const done = (statusId: string) => OPTIONS.find((o) => o.id === statusId)?.category === "completed";
  const base = `/${orgSlug}`;

  return [
    ...tasks.filter((t) => inRange(t.dueDate)).map<CalendarEvent>((t) => ({
      id: t.id, date: t.dueDate!, kind: "task", label: `${project(t.projectId).key}-${t.number} ${t.title}`,
      sub: project(t.projectId).name, late: !done(t.statusId) && t.dueDate! < today, statusId: t.statusId,
      href: `${base}/projects/${project(t.projectId).key.toLowerCase()}`,
    })),
    ...projects.filter((p) => inRange(p.dueDate)).map<CalendarEvent>((p) => ({
      id: p.id, date: p.dueDate!, kind: "deadline", label: p.name, sub: "Project deadline", late: false, statusId: null,
      href: `${base}/projects/${p.key.toLowerCase()}`,
    })),
    ...milestones.filter((m) => inRange(m.dueDate)).map<CalendarEvent>((m) => ({
      id: m.id, date: m.dueDate, kind: "milestone", label: `${project(m.projectId).key} · ${m.name}`, sub: "Milestone", late: false, statusId: null,
      href: `${base}/projects/${project(m.projectId).key.toLowerCase()}`,
    })),
    ...releases.filter((r) => inRange(r.releaseDate)).map<CalendarEvent>((r) => ({
      id: r.id, date: r.releaseDate!, kind: "release", label: `${project(r.projectId).key} ${r.version}`, sub: "Release", late: false, statusId: null,
      href: `${base}/releases?release=${r.id}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
