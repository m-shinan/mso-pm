const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today to an ISO date (negative = past). */
export function daysFromToday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(new Date()).getTime()) / DAY);
}

const long = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
// Fixed three-letter months: en-GB writes "Sept", and locales differ between server and browser.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(d: Date, year = false) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}`;
}

export function formatDate(iso: string, opts: { year?: boolean } = {}) {
  return shortDate(parseISODate(iso), opts.year);
}

export function formatToday() {
  return long.format(new Date());
}

/** "Overdue 2d", "Today", "Tomorrow", "3 Oct" — plus whether it is late. */
export function dueLabel(iso: string | null): { text: string; late: boolean } {
  if (!iso) return { text: "No date", late: false };
  const n = daysFromToday(iso);
  if (n < 0) return { text: `Overdue ${-n}d`, late: true };
  if (n === 0) return { text: "Today", late: false };
  if (n === 1) return { text: "Tomorrow", late: false };
  return { text: formatDate(iso), late: false };
}

/** "25 min ago", "2 hours ago", "Yesterday", "3 days ago", "12 Sep". */
export function timeAgo(isoTimestamp: string) {
  const mins = Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return shortDate(new Date(isoTimestamp));
}

export function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
