import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { DeleteAccountForm } from "@/features/auth/delete-account";
import { EmailPreferences } from "@/features/auth/email-preferences";
import { HOME } from "@/lib/auth";
import { createClient, getUserId } from "@/lib/supabase/server";

export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login?next=/account");
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, email_notifications, email_assignments, email_reviews, email_deadlines, email_comments, email_projects, email_chat")
    .eq("id", userId)
    .single();
  const email = profile?.email ?? "";

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pb-16">
      <div className="flex h-14 items-center self-stretch lg:px-4">
        <Link href={HOME} className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </Link>
      </div>
      <main className="flex w-full max-w-[640px] flex-col gap-5 pt-4">
        <h1 className="text-3xl font-semibold tracking-[-0.01em]">Account settings</h1>

        <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-5 py-4">
          <h2 className="text-md font-semibold">Profile</h2>
          <p className="text-base">{profile?.full_name || "No name set"}</p>
          <p className="text-sm text-ink-3">{email}</p>
        </section>

        {profile ? (
          <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-md font-semibold">Email notifications</h2>
            <EmailPreferences
              userId={userId}
              initial={{
                email_notifications: profile.email_notifications,
                email_assignments: profile.email_assignments,
                email_reviews: profile.email_reviews,
                email_deadlines: profile.email_deadlines,
                email_comments: profile.email_comments,
                email_projects: profile.email_projects,
                email_chat: profile.email_chat,
              }}
            />
          </section>
        ) : null}

        <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
            <h2 className="text-md font-semibold">Password</h2>
            <p className="text-sm text-ink-3">Change the password you use to sign in.</p>
          </div>
          <Link href="/account/password" className={buttonClass("secondary", "md", "max-lg:h-11")}>Change password</Link>
        </section>

        <section aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-xl border border-danger-line bg-surface px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2 id="delete-title" className="text-md font-semibold text-danger-ink">Delete account</h2>
            <p className="text-sm text-ink-3">Permanently remove your account. This can’t be undone.</p>
          </div>
          <DeleteAccountForm email={email} />
        </section>
      </main>
    </div>
  );
}
