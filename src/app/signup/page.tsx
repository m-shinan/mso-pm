import Link from "next/link";
import { signUp } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <AuthForm
        title="Create your account"
        subtitle="Then create an organization, or accept an invitation."
        action={signUp}
        fields={["name", "email", "password"]}
        newPassword
        submit="Create account"
        next={next}
        footer={<>Already have an account? <Link href="/login" className="text-accent">Sign in</Link></>}
      />
    </div>
  );
}
