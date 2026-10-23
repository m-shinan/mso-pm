"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type CodeType = "signup" | "recovery";

export interface AuthState {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password" | "name" | "code", string>>;
  notice?: string;
  /** Set when the next step is typing the code we emailed. */
  verify?: { email: string; type: CodeType; next?: string };
}

const email = z.string().trim().toLowerCase().pipe(z.email("That doesn’t look like an email address."));
const password = z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters.");

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
    if (error.code === "email_not_confirmed") {
      // Send a fresh code and go straight to the code step.
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      return {
        verify: { email: parsed.data.email, type: "signup", next: safeNext(form.get("next")) },
        notice: `Confirm your email first. We’ve sent a new code to ${parsed.data.email}.`,
      };
    }
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
  return { verify: { email: parsed.data.email, type: "signup", next }, notice: `We sent a 6-digit code to ${parsed.data.email}.` };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/account/password`,
  });
  // Same answer whether or not the account exists.
  return { verify: { email: parsed.data, type: "recovery" }, notice: `If an account exists for ${parsed.data}, we’ve sent it a code.` };
}

const code = z.string().trim().regex(/^\d{6,8}$/, "Enter the code from the email: digits only.");

/** Second step of sign-up and password reset: the emailed code signs you in. */
export async function verifyCode(_: AuthState, form: FormData): Promise<AuthState> {
  const type: CodeType = form.get("type") === "recovery" ? "recovery" : "signup";
  const next = safeNext(form.get("next"));
  const parsedEmail = email.safeParse(form.get("email"));
  if (!parsedEmail.success) return { error: "Start again: we lost track of your email address." };
  const verify = { email: parsedEmail.data, type, next };
  const parsed = code.safeParse(form.get("code"));
  if (!parsed.success) return { verify, fieldErrors: { code: parsed.error.issues[0].message } };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: verify.email, token: parsed.data, type: type === "recovery" ? "recovery" : "email" });
  if (error) {
    if (error.code === "otp_expired" || error.status === 403) return { verify, fieldErrors: { code: "That code is wrong or has expired. Check it, or send a new one." } };
    return { verify, error: friendlyError(error, "check the code") };
  }
  redirect(type === "recovery" ? "/account/password" : next);
}

/** Send the code again (rate-limited by Supabase). */
export async function resendCode(_: AuthState, form: FormData): Promise<AuthState> {
  const type: CodeType = form.get("type") === "recovery" ? "recovery" : "signup";
  const parsedEmail = email.safeParse(form.get("email"));
  if (!parsedEmail.success) return { error: "Start again: we lost track of your email address." };
  const verify = { email: parsedEmail.data, type, next: safeNext(form.get("next")) };
  const supabase = await createClient();
  const { error } =
    type === "recovery"
      ? await supabase.auth.resetPasswordForEmail(verify.email, { redirectTo: `${await origin()}/auth/callback?next=/account/password` })
      : await supabase.auth.resend({ type: "signup", email: verify.email });
  if (error?.code === "over_email_send_rate_limit") return { verify, error: "Too many codes sent. Wait a minute, then try again." };
  if (error) return { verify, error: friendlyError(error, "send a new code") };
  return { verify, notice: `We sent a new code to ${verify.email}.` };
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
  redirect("/app?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Permanently deletes the signed-in user. They must retype their email; sole owners are refused by the database. */
export async function deleteAccount(_: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const mine = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : null;
  if (!mine) return { error: "Your session ended. Sign in again." };
  const typed = String(form.get("email") ?? "").trim().toLowerCase();
  if (typed !== mine) return { fieldErrors: { email: "Type your email exactly as shown to confirm." } };

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: friendlyError(error, "delete your account") };
  // The user and their sessions are gone; this only clears the cookies.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
