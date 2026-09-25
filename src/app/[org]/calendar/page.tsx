import { PageHeader } from "@/components/shell/page-header";
import { CalendarView } from "@/features/calendar/components";
import { listCalendar } from "@/features/calendar/queries";
import { requireOrg } from "@/features/org/queries";

export const metadata = { title: "Calendar" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({ params, searchParams }: PageProps<"/[org]/calendar">) {
  const { org } = await requireOrg(params);
  const sp = await searchParams;
  const now = new Date();
  const current = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const month = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : current;
  const [y, m] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  };
  // Load the visible grid (up to 6 weeks) — including overdue items still open.
  const from = new Date(y, m - 1, -6);
  const to = new Date(y, m, 14);
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const events = await listCalendar(org.id, org.slug, iso(from), iso(to));
  const base = `/${org.slug}/calendar`;

  return (
    <>
      <PageHeader orgName={org.name} crumbs={[{ label: "Calendar" }]} />
      <main className="flex min-h-[calc(100dvh-52px)] flex-col px-4 py-5 lg:px-8 lg:py-5">
        <CalendarView month={month} events={events} prevHref={`${base}?m=${shift(-1)}`} nextHref={`${base}?m=${shift(1)}`} todayHref={base} />
      </main>
    </>
  );
}
