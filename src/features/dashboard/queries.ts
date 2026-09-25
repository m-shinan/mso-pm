import "server-only";
import { dataset } from "@/mock/store";
import { OPTIONS } from "@/mock/data";
import { daysFromToday } from "@/lib/format";

const cat = (id: string) => OPTIONS.find((o) => o.id === id)?.category ?? null;
const rank = (id: string) => OPTIONS.find((o) => o.id === id)?.rank ?? 0;

/**
 * Everything the dashboard shows, in one call. In Supabase this becomes a single
 * `dashboard_summary(org_id)` SQL function returning counts plus short lists —
 * never the underlying rows.
 */
export async function getDashboard(orgId: string, userId: string) {
  const { tasks, issues, projects, releases, milestones } = dataset(orgId);
  const keyOf = (projectId: string) => projects.find((p) => p.id === projectId)!.key;
  const nameOf = (projectId: string) => projects.find((p) => p.id === projectId)!.name;

  const openTask = (statusId: string) => cat(statusId) !== "completed";
  const openIssues = issues.filter((i) => ["open", "active"].includes(cat(i.statusId) ?? ""));
  const critical = openIssues.filter((i) => rank(i.severityId) >= 4);
  const mine = tasks.filter((t) => t.assigneeId === userId && openTask(t.statusId));
  const overdue = tasks.filter((t) => openTask(t.statusId) && t.dueDate && daysFromToday(t.dueDate) < 0);
  const blocked = tasks.filter((t) => cat(t.statusId) === "blocked");
  const dueToday = mine.filter((t) => t.dueDate && daysFromToday(t.dueDate) === 0);
  const activeProjects = projects.filter((p) => cat(p.statusId) === "active");

  const taskItem = (t: (typeof tasks)[number]) => ({
    ...t,
    key: `${keyOf(t.projectId)}-${t.number}`,
    projectName: nameOf(t.projectId),
  });

  type Attention = {
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
  };
  const attention: Attention[] = [
    ...critical.map((i) => ({
      id: i.id, kind: "issue" as const, title: i.title, key: `${keyOf(i.projectId)}-${i.number}`,
      project: nameOf(i.projectId), reason: "Critical issue", tone: "danger" as const, severityId: i.severityId, personId: i.assigneeId,
    })),
    ...overdue.map((t) => ({
      id: t.id, kind: "task" as const, title: t.title, key: `${keyOf(t.projectId)}-${t.number}`,
      project: nameOf(t.projectId), reason: `Overdue ${-daysFromToday(t.dueDate!)}d`, tone: "warn" as const, statusId: t.statusId, personId: t.assigneeId,
    })),
    ...blocked.map((t) => ({
      id: t.id, kind: "task" as const, title: t.title, key: `${keyOf(t.projectId)}-${t.number}`,
      project: nameOf(t.projectId), reason: "Blocked", tone: "danger" as const, statusId: t.statusId, personId: t.assigneeId,
    })),
    ...projects
      .filter((p) => cat(p.statusId) === "active" && p.dueDate && daysFromToday(p.dueDate) <= 14 && daysFromToday(p.dueDate) >= 0)
      .map((p) => ({
        id: p.id, kind: "project" as const, title: `${p.name} deadline`, key: p.key, project: p.name,
        reason: `Due in ${daysFromToday(p.dueDate!)} days · ${Math.round((p.tasksDone / p.tasksTotal) * 100)}%`,
        tone: "neutral" as const, personId: null,
      })),
  ];

  const deadlines = [
    ...projects.filter((p) => p.dueDate).map((p) => ({ id: p.id, date: p.dueDate!, title: p.name, kind: "Project deadline" })),
    ...releases.filter((r) => cat(r.statusId) !== "released" && r.releaseDate).map((r) => ({ id: r.id, date: r.releaseDate!, title: `${nameOf(r.projectId)} ${r.version}`, kind: "Release" })),
    ...milestones.map((m) => ({ id: m.id, date: m.dueDate, title: `${nameOf(m.projectId)} · ${m.name}`, kind: "Milestone" })),
  ]
    .filter((d) => daysFromToday(d.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const byDue = (a: { dueDate: string | null }, b: { dueDate: string | null }) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

  return {
    stats: {
      activeProjects: activeProjects.length,
      dueToday: dueToday.length,
      overdue: overdue.length,
      oldestOverdueDays: overdue.length ? Math.max(...overdue.map((t) => -daysFromToday(t.dueDate!))) : 0,
      openIssues: openIssues.length,
      criticalIssues: critical.length,
      blocked: blocked.length,
    },
    attention: attention.slice(0, 6),
    myWork: {
      // "Today" = overdue + due today, matching the Due today / Overdue counts above it.
      today: mine.filter((t) => t.dueDate && daysFromToday(t.dueDate) <= 0).sort(byDue).map(taskItem),
      upcoming: mine.filter((t) => !t.dueDate || daysFromToday(t.dueDate) > 0).sort(byDue).map(taskItem),
      blocked: mine.filter((t) => cat(t.statusId) === "blocked").map(taskItem),
    },
    deadlines,
    projects: activeProjects
      .concat(projects.filter((p) => cat(p.statusId) === "planned"))
      .slice(0, 5),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
