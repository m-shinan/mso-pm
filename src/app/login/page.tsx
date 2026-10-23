import Link from "next/link";
import { signIn } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Sign in", description: "Sign in to mso-pm, the free project management tool for software teams.", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const failed = sp.error === "link";
  const expired = sp.expired === "1";
  const deleted = sp.deleted === "1";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      {failed ? (
        <p role="alert" className="max-w-[380px] rounded-lg border border-danger-line bg-danger-surface px-3 py-2.5 text-sm">
          That link has expired or was already used. Sign in, or request a new one.
        </p>
      ) : null}
      {expired ? (
        <p role="status" className="max-w-[380px] rounded-lg border border-line px-3 py-2.5 text-sm">
          You’ve been signed out after 30 days. Sign in again to continue.
        </p>
      ) : null}
      {deleted ? (
        <p role="status" className="max-w-[380px] rounded-lg border border-line px-3 py-2.5 text-sm">
          Your account has been deleted. Thanks for using mso-pm.
        </p>
      ) : null}
      <AuthForm
        title="Sign in to mso-pm"
        subtitle="One account for all your organizations."
        action={signIn}
        fields={["email", "password"]}
        submit="Sign in"
        next={next}
        aside={<Link href="/reset-password" className="font-normal text-accent">Forgot?</Link>}
        footer={<>New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-accent">Create an account</Link></>}
      />
    </div>
  );
}
