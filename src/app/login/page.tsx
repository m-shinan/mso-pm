import Link from "next/link";
import { signIn } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const failed = sp.error === "link";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-10">
      {failed ? (
        <p role="alert" className="max-w-[380px] rounded-lg border border-danger-line bg-danger-surface px-3 py-2.5 text-sm">
          That link has expired or was already used. Sign in, or request a new one.
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
