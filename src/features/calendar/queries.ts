import "server-only";
import { createClient } from "@/lib/supabase/server";

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

/** Dated items in [from, to], unioned and filtered by date in SQL (calendar_items RPC). */
export async function listCalendar(orgId: string, orgSlug: string, from: string, to: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_items", { p_org: orgId, p_from: from, p_to: to });
  if (error) throw error;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const base = `/${orgSlug}`;
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.day,
    kind: r.kind as CalendarKind,
    label: r.label,
    sub: r.sub,
    late: r.kind === "task" && !r.done && r.day < todayIso,
    statusId: r.status_id,
    href:
      r.kind === "release"
        ? `${base}/releases?release=${r.id}`
        : `${base}/projects/${r.project_key.toLowerCase()}`,
  }));
}
