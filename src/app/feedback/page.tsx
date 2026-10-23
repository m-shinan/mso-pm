import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FeedbackInbox, type FeedbackItem } from "@/features/feedback/inbox";
import { HOME } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata = { title: "Feedback inbox" };

/** Feature requests and issue reports from every user. Platform admins only; everyone else gets a 404. */
export default async function FeedbackInboxPage() {
  if (!(await getUserId())) redirect("/login?next=/feedback");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) notFound();

  const { data, error } = await supabase
    .from("feedback")
    .select("id, kind, subject, body, page, user_agent, user_name, user_email, organization_name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const items: FeedbackItem[] = (data ?? []).map((f) => ({
    id: f.id,
    kind: f.kind === "issue" ? "issue" : "feature",
    subject: f.subject,
    body: f.body,
    page: f.page,
    userAgent: f.user_agent,
    userName: f.user_name,
    userEmail: f.user_email,
    organizationName: f.organization_name,
    status: f.status === "done" ? "done" : "open",
    createdAt: f.created_at,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line bg-surface px-4 py-3.5 lg:px-7">
        <Link href={HOME} className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">m</span>
          mso-pm
        </Link>
        <span aria-hidden className="text-ink-6">/</span>
        <h1 className="text-lg font-semibold">Feedback inbox</h1>
        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn-ink">Only you can see this</span>
        <span className="text-xs text-ink-4 lg:ml-auto">New items are also emailed to you.</span>
      </header>
      <FeedbackInbox initial={items} loadError={error ? friendlyError(error, "load feedback") : null} />
    </div>
  );
}
