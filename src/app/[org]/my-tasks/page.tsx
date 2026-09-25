import { CircleCheck } from "lucide-react";
import { TaskLine } from "@/components/domain/task-line";
import { PageHeader, PageTitle } from "@/components/shell/page-header";
import { NewTaskButton } from "@/components/shell/quick-create";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/states";
import { requireOrg } from "@/features/org/queries";
import { listMyTasks, type TaskRow } from "@/features/tasks/queries";
import { daysFromToday } from "@/lib/format";

export const metadata = { title: "My tasks" };

const BUCKETS = [
  { id: "overdue", title: "Overdue", test: (n: number | null) => n !== null && n < 0 },
  { id: "today", title: "Today", test: (n: number | null) => n === 0 },
  { id: "week", title: "Next 7 days", test: (n: number | null) => n !== null && n > 0 && n <= 7 },
  { id: "later", title: "Later", test: (n: number | null) => n !== null && n > 7 },
  { id: "none", title: "No due date", test: (n: number | null) => n === null },
];

export default async function MyTasksPage({ params }: PageProps<"/[org]/my-tasks">) {
  const { org, ctx } = await requireOrg(params);
  const done = new Set(ctx.options.filter((o) => o.category === "completed").map((o) => o.id));
  const tasks = (await listMyTasks(org.id, ctx.currentUserId)).filter((t) => !done.has(t.statusId));
  const groups = BUCKETS.map((b) => ({
    ...b,
    tasks: tasks
      .filter((t) => b.test(t.dueDate ? daysFromToday(t.dueDate) : null))
      .sort((a: TaskRow, z: TaskRow) => (a.dueDate ?? "").localeCompare(z.dueDate ?? "")),
  })).filter((g) => g.tasks.length);

  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "My tasks" }]} actions={<NewTaskButton />} />
      <main className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
        <PageTitle title="My tasks" eyebrow={`${tasks.length} open across ${new Set(tasks.map((t) => t.projectId)).size} projects`} />
        {groups.length === 0 ? (
          <EmptyState icon={CircleCheck} title="No tasks assigned to you">
            Tasks you’re assigned to in {org.name} show up here.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <Section key={g.id} id={`bucket-${g.id}`} title={<span className={g.id === "overdue" ? "text-late" : undefined}>{g.title}</span>} count={g.tasks.length}>
              <div className="border-t border-line-soft">
                {g.tasks.map((t) => <TaskLine key={t.id} task={t} />)}
              </div>
            </Section>
          ))
        )}
      </main>
    </>
  );
}
