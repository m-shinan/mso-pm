import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { AcceptInvite } from "@/features/team/accept-invite";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!(await getUserId())) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const supabase = await createClient();
  const [{ data: rows }, { data: claims }] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }),
    supabase.auth.getClaims(),
  ]);
  const inv = rows?.[0];
  const myEmail = String(claims?.claims?.email ?? "").toLowerCase();

  let body: React.ReactNode;
  if (!inv || inv.status === "revoked") {
    body = <p className="text-base text-ink-2">This invitation link isn’t valid. Ask the person who invited you for a new one.</p>;
  } else if (inv.status === "accepted") {
    body = (
      <>
        <p className="text-base text-ink-2">This invitation to {inv.organization_name} has already been used.</p>
        <Link href="/" className={buttonClass("secondary", "md", "self-start max-lg:h-11")}>Go to your dashboard</Link>
      </>
    );
  } else if (inv.expired) {
    body = <p className="text-base text-ink-2">This invitation to {inv.organization_name} has expired. Ask for a new one.</p>;
  } else if (inv.email !== myEmail) {
    body = (
      <p className="text-base leading-normal text-ink-2">
        This invitation was sent to <span className="font-medium text-ink">{inv.email}</span>, but you’re signed in as{" "}
        <span className="font-medium text-ink">{myEmail}</span>. Sign in with the invited address to accept it.
      </p>
    );
  } else {
    body = (
      <>
        <p className="text-base leading-normal text-ink-2">
          You’ve been invited to join <span className="font-medium text-ink">{inv.organization_name}</span> as{" "}
          <span className="font-medium text-ink">{inv.role_name}</span>.
        </p>
        <AcceptInvite token={token} />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold">Invitation</h1>
        {body}
      </div>
    </div>
  );
}
