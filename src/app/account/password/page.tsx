import { redirect } from "next/navigation";
import { updatePassword } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";
import { getUserId } from "@/lib/supabase/server";

export const metadata = { title: "New password" };

/** Reached from the reset email (the callback signs you in first) or from the account menu. */
export default async function NewPasswordPage() {
  if (!(await getUserId())) redirect("/login");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <AuthForm
        title="Choose a new password"
        subtitle="At least 8 characters."
        action={updatePassword}
        fields={["password", "confirm"]}
        newPassword
        submit="Save password"
      />
    </div>
  );
}
