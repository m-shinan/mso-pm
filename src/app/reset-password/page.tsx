import Link from "next/link";
import { requestPasswordReset } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <AuthForm
        title="Reset your password"
        subtitle="We’ll email you a link to set a new one."
        action={requestPasswordReset}
        fields={["email"]}
        submit="Send reset link"
        footer={<Link href="/login" className="text-accent">Back to sign in</Link>}
      />
    </div>
  );
}
