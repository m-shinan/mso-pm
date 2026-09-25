"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "name", string>>;
  notice?: string;
}

const email = z.string().trim().toLowerCase().pipe(z.email("That doesn’t look like an email address."));
const password = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

/** Only allow redirects back into this app. */
function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) {
    const f = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { email: f.email?.[0], password: f.password?.[0] } };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Confirm your email first. Check your inbox for the link." };
    if (error.code === "invalid_credentials") return { error: "Wrong email or password." };
    return { error: friendlyError(error, "sign in") };
  }
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name.").max(120), email, password })
    .safeParse({ name: form.get("name"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) {
    const f = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { name: f.name?.[0], email: f.email?.[0], password: f.password?.[0] } };
  }
  const supabase = await createClient();
  const next = safeNext(form.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "An account with that email already exists. Sign in instead." };
    if (error.code === "weak_password") return { fieldErrors: { password: "Choose a stronger password." } };
    return { error: friendlyError(error, "create your account") };
  }
  if (data.session) redirect(next);
  return { notice: `Check ${parsed.data.email} for a confirmation link, then come back to sign in.` };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/account/password`,
  });
  // Same answer whether or not the account exists.
  return { notice: `If an account exists for ${parsed.data}, a reset link is on its way.` };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { fieldErrors: { password: parsed.error.issues[0].message } };
  if (form.get("password") !== form.get("confirm")) return { fieldErrors: { password: "The two passwords don’t match." } };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { fieldErrors: { password: "Choose a password you haven’t used here." } };
    return { error: friendlyError(error, "update your password") };
  }
  redirect("/?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
