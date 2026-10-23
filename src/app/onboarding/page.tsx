import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CreateOrgForm } from "@/features/org/create-org-form";
import { listMyOrgs } from "@/features/org/queries";
import { ArchivedOrgs } from "@/features/org/archived-orgs";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata = { title: "Create organization" };

export default async function OnboardingPage() {
  if (!(await getUserId())) redirect("/login");
  const orgs = await listMyOrgs();
  const supabase = await createClient();
  const { data: archived } = await supabase.rpc("my_archived_organizations");
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-10">
      <div className="flex h-14 items-center self-stretch lg:px-4">
        {orgs.length ? (
          <Link href="/app" className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
            Back
          </Link>
        ) : null}
      </div>
      <CreateOrgForm first={orgs.length === 0} />
      {orgs.length === 0 ? (
        <p className="mt-4 max-w-[600px] text-center text-sm text-ink-4">Joining someone else’s organization? Open the invite link they sent you.</p>
      ) : null}
      <ArchivedOrgs orgs={archived ?? []} />
    </div>
  );
}
