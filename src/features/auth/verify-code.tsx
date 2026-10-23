"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { resendCode, verifyCode, type AuthState } from "./actions";

/** "Enter the 6-digit code": the second step of sign-up and password reset. */
export function VerifyCodeForm({ initial }: { initial: AuthState & { verify: NonNullable<AuthState["verify"]> } }) {
  const [state, action, pending] = useActionState(verifyCode, initial);
  const [resent, resend, resending] = useActionState(resendCode, {});
  const v = state.verify ?? initial.verify;
  const message = resent.notice ?? state.notice;
  const hidden = (
    <>
      <input type="hidden" name="email" value={v.email} />
      <input type="hidden" name="type" value={v.type} />
      {v.next ? <input type="hidden" name="next" value={v.next} /> : null}
    </>
  );

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-1">
        <span aria-hidden className="mb-2 inline-flex size-9 items-center justify-center rounded-lg bg-inverse text-[15px] font-semibold text-on-inverse">m</span>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{v.type === "recovery" ? "Reset your password" : "Confirm your email"}</h1>
        <p role="status" className="text-sm text-ink-3">{message ?? `Enter the code we sent to ${v.email}.`}</p>
      </div>
      {state.error || resent.error ? <ErrorState message={(resent.error ?? state.error)!} /> : null}
      <form action={action} noValidate className="flex flex-col gap-4">
        {hidden}
        <Field label="Code" error={state.fieldErrors?.code} hint="It expires after 15 minutes.">
          {(p) => (
            <Input
              {...p}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="123456"
              autoFocus
              required
              className="text-center font-mono text-xl tracking-[0.4em] max-lg:text-2xl"
            />
          )}
        </Field>
        <Button variant="primary" type="submit" disabled={pending} className="h-9 max-lg:h-11">
          {pending ? "Checking…" : v.type === "recovery" ? "Continue" : "Confirm email"}
        </Button>
      </form>
      <form action={resend} className="flex items-center justify-between text-sm text-ink-3">
        {hidden}
        <span>No email? Check spam, or</span>
        <button type="submit" disabled={resending} className="font-medium text-accent disabled:opacity-60">
          {resending ? "Sending…" : "send a new code"}
        </button>
      </form>
      <Link href="/login" className="text-center text-sm text-ink-3 hover:text-ink">Back to sign in</Link>
    </div>
  );
}
