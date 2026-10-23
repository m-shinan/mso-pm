import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { OrganizationActions, PlatformAdminForm, RevokeAdminButton, UserActions } from "@/features/admin/actions";
import { HOME } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { formatDate, timeAgo } from "@/lib/format";
import { createClient, getUserId } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin console" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "organizations", label: "Organizations" },
  { id: "emails", label: "Emails" },
  { id: "audit", label: "Audit log" },
] as const;
type Tab = (typeof TABS)[number]["id"];
const PAGE = 50;

/** Platform admins only (everyone else gets a 404). Metadata and account actions, never organization content. */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();

  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "overview";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Math.max(0, Number(sp.page) || 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line bg-surface px-4 py-3.5 lg:px-7">
        <Link href={HOME} className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">m</span>
          mso-pm
        </Link>
        <span aria-hidden className="text-ink-6">/</span>
        <h1 className="text-lg font-semibold">Admin console</h1>
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-ink">Platform admins only</span>
        <Link href="/feedback" className="text-sm text-accent lg:ml-auto">Feedback inbox</Link>
      </header>
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 lg:px-6">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("border-b-2 px-3 py-2.5 text-sm whitespace-nowrap", tab === t.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <main className="flex flex-col gap-5 px-4 py-6 lg:px-8">
        {tab === "overview" ? <Overview /> : null}
        {tab === "users" ? <Users q={q} page={page} me={userId} /> : null}
        {tab === "organizations" ? <Organizations q={q} page={page} /> : null}
        {tab === "emails" ? <Emails /> : null}
        {tab === "audit" ? <Audit /> : null}
      </main>
    </div>
  );
}

async function Overview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) return <ErrorState message={friendlyError(error, "load the numbers")} />;
  const s = (data ?? {}) as Record<string, number>;
  const tiles: [string, number | undefined, string?][] = [
    ["Users", s.users, `${s.users_confirmed ?? 0} confirmed · ${s.users_suspended ?? 0} suspended`],
    ["Active in 7 days", s.users_active_7d, `${s.users_new_7d ?? 0} new this week`],
    ["Organizations", s.organizations, `${s.organizations_archived ?? 0} archived`],
    ["Projects", s.projects],
    ["Tasks", s.tasks, `${s.tasks_new_7d ?? 0} created this week`],
    ["Chat messages, 7 days", s.messages_7d],
    ["Open feedback", s.feedback_open],
    ["Emails, 24 hours", s.emails_24h, `${s.emails_failed_24h ?? 0} failed`],
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5">
            <span className="text-sm text-ink-3">{label}</span>
            <span className="text-3xl font-semibold tabular">{value ?? "–"}</span>
            {sub ? <span className="text-xs text-ink-4">{sub}</span> : null}
          </div>
        ))}
      </div>
      <PlatformAdmins />
    </>
  );
}

async function PlatformAdmins() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", { p_search: "", p_limit: 200 });
  const admins = (data ?? []).filter((u) => u.platform_admin);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4">
      <h2 className="text-md font-semibold">Platform admins</h2>
      <ul className="flex flex-col divide-y divide-line-soft">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2">
            <span className="grow text-base">{a.email}</span>
            {admins.length > 1 ? <RevokeAdminButton email={a.email} /> : null}
          </li>
        ))}
        {admins.length === 0 ? <li className="py-2 text-sm text-ink-4">Admins who haven’t signed up yet don’t appear here.</li> : null}
      </ul>
      <PlatformAdminForm />
    </section>
  );
}

function SearchBar({ tab, q, placeholder }: { tab: Tab; q: string; placeholder: string }) {
  return (
    <form action="/admin" className="flex flex-wrap gap-2">
      <input type="hidden" name="tab" value={tab} />
      <label htmlFor="admin-q" className="sr-only">Search</label>
      <input
        id="admin-q"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-[34px] min-w-[240px] grow rounded-md border border-line-strong bg-surface px-2.5 text-base focus:border-accent focus:ring-3 focus:ring-accent-ring focus:outline-none max-lg:h-11 lg:max-w-sm"
      />
      <button type="submit" className={buttonClass("secondary", "md", "max-lg:h-11")}>Search</button>
    </form>
  );
}

function Pager({ tab, q, page, total }: { tab: Tab; q: string; page: number; total: number }) {
  const pages = Math.ceil(total / PAGE);
  if (pages <= 1) return null;
  const link = (p: number) => `/admin?tab=${tab}&q=${encodeURIComponent(q)}&page=${p}`;
  return (
    <div className="flex items-center gap-3 text-sm text-ink-3">
      {page > 0 ? <Link href={link(page - 1)} className={buttonClass("secondary", "sm")}>Previous</Link> : null}
      <span>Page {page + 1} of {pages}</span>
      {page + 1 < pages ? <Link href={link(page + 1)} className={buttonClass("secondary", "sm")}>Next</Link> : null}
    </div>
  );
}

async function Users({ q, page, me }: { q: string; page: number; me: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: q, p_limit: PAGE, p_offset: page * PAGE });
  const rows = data ?? [];
  return (
    <>
      <SearchBar tab="users" q={q} placeholder="Search by name or email" />
      {error ? <ErrorState message={friendlyError(error, "load users")} /> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-4">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Person</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Orgs</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Joined</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Last sign-in</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{u.full_name || "No name"}{u.platform_admin ? <span className="ml-2 rounded bg-accent-soft px-1.5 text-2xs text-accent-hover">admin</span> : null}</span>
                  <span className="block text-xs text-ink-4">{u.email}</span>
                </td>
                <td className="px-3 py-2.5">
                  {u.suspended ? <span className="text-danger-ink">Suspended</span> : u.confirmed ? <span className="text-success-ink">Active</span> : <span className="text-warn-ink">Unconfirmed</span>}
                </td>
                <td className="px-3 py-2.5 tabular">{u.organizations}</td>
                <td className="px-3 py-2.5 text-ink-3">{formatDate(u.created_at.slice(0, 10), { year: true })}</td>
                <td className="px-3 py-2.5 text-ink-3" suppressHydrationWarning>{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : "Never"}</td>
                <td className="px-4 py-2.5"><UserActions id={u.id} email={u.email} suspended={u.suspended} isSelf={u.id === me} /></td>
              </tr>
            ))}
            {rows.length === 0 && !error ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-4">{q ? "No one matches that search." : "No users yet."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager tab="users" q={q} page={page} total={Number(rows[0]?.total ?? 0)} />
    </>
  );
}

async function Organizations({ q, page }: { q: string; page: number }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_organizations", { p_search: q, p_limit: PAGE, p_offset: page * PAGE });
  const rows = data ?? [];
  return (
    <>
      <SearchBar tab="organizations" q={q} placeholder="Search by name or URL" />
      {error ? <ErrorState message={friendlyError(error, "load organizations")} /> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-4">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Organization</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Members</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Projects</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Tasks</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Last activity</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{o.name}{o.archived_at ? <span className="ml-2 rounded bg-subtle px-1.5 text-2xs text-ink-3">archived</span> : null}</span>
                  <span className="block font-mono text-xs text-ink-4">/{o.slug}</span>
                </td>
                <td className="px-3 py-2.5 text-ink-3">{o.owner_email ?? "–"}</td>
                <td className="px-3 py-2.5 tabular">{o.members}</td>
                <td className="px-3 py-2.5 tabular">{o.projects}</td>
                <td className="px-3 py-2.5 tabular">{o.tasks}</td>
                <td className="px-3 py-2.5 text-ink-3" suppressHydrationWarning>{o.last_activity_at ? timeAgo(o.last_activity_at) : "None"}</td>
                <td className="px-4 py-2.5"><OrganizationActions id={o.id} name={o.name} archived={Boolean(o.archived_at)} /></td>
              </tr>
            ))}
            {rows.length === 0 && !error ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-4">{q ? "Nothing matches that search." : "No organizations yet."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager tab="organizations" q={q} page={page} total={Number(rows[0]?.total ?? 0)} />
    </>
  );
}

async function Emails() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_recent_emails", { p_limit: 100 });
  const rows = data ?? [];
  return (
    <>
      <p className="max-w-2xl text-sm text-ink-3">
        The last 100 emails the app sent through Resend (notifications, feedback, account emails), with the answer Resend gave.
        Sign-in codes are sent by Supabase directly and appear in Resend’s own logs instead.
      </p>
      {error ? <ErrorState message={friendlyError(error, "load emails")} /> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-4">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">When</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Result</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((r) => {
              const ok = r.status_code !== null && r.status_code < 400;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-ink-3" suppressHydrationWarning>{timeAgo(r.created_at)}</td>
                  <td className={cn("px-3 py-2.5", ok ? "text-success-ink" : "text-danger-ink")}>{r.status_code ?? "No answer"}{ok ? " · sent" : ""}</td>
                  <td className="px-4 py-2.5 font-mono text-xs break-all text-ink-3">{r.error ?? ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !error ? <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-4">No emails sent recently.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function Audit() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_email, action, target_type, target_label, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  return (
    <>
      {error ? <ErrorState message={friendlyError(error, "load the audit log")} /> : null}
      <ul className="flex flex-col divide-y divide-line-soft rounded-xl border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
            <span className="font-medium">{r.actor_email ?? "Someone"}</span>
            <span className="text-ink-2">{r.action.replaceAll("_", " ")}</span>
            <span className="text-ink-3">{r.target_label}</span>
            <span className="ml-auto text-xs text-ink-4" suppressHydrationWarning>{timeAgo(r.created_at)}</span>
          </li>
        ))}
        {rows.length === 0 && !error ? <li className="px-4 py-8 text-center text-sm text-ink-4">No admin actions yet.</li> : null}
      </ul>
    </>
  );
}
