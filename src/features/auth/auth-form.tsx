"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import type { AuthState } from "./actions";

type FieldName = "name" | "email" | "password" | "confirm";

const FIELDS: Record<FieldName, { label: string; type: string; autoComplete: string; inputMode?: "email" }> = {
  name: { label: "Your name", type: "text", autoComplete: "name" },
  email: { label: "Email", type: "email", autoComplete: "email", inputMode: "email" },
  password: { label: "Password", type: "password", autoComplete: "current-password" },
  confirm: { label: "Repeat password", type: "password", autoComplete: "new-password" },
};

/** Shared card for sign in / sign up / reset / new password. */
export function AuthForm({
  title,
  subtitle,
  action,
  fields,
  submit,
  next,
  newPassword,
  footer,
  aside,
}: {
  title: string;
  subtitle: string;
  action: (state: AuthState, form: FormData) => Promise<AuthState>;
  fields: FieldName[];
  submit: string;
  next?: string;
  newPassword?: boolean;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.notice) {
    return (
      <div className="flex w-full max-w-[380px] flex-col gap-3 rounded-xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-semibold">Check your inbox</h1>
        <p className="text-base leading-normal text-ink-2">{state.notice}</p>
        <Link href="/login" className="text-sm text-accent">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex w-full max-w-[380px] flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-1">
        <span aria-hidden className="mb-2 inline-flex size-9 items-center justify-center rounded-lg bg-inverse text-[15px] font-semibold text-on-inverse">m</span>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="text-sm text-ink-3">{subtitle}</p>
      </div>
      {state.error ? <ErrorState message={state.error} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {fields.map((name) => {
        const f = FIELDS[name];
        const err = state.fieldErrors?.[name === "confirm" ? "password" : name];
        return (
          <Field
            key={name}
            label={name === "password" && aside ? <span className="flex w-full justify-between">{f.label}{aside}</span> : f.label}
            error={name === "confirm" ? undefined : err}
          >
            {(p) => (
              <Input
                {...p}
                name={name}
                type={f.type}
                inputMode={f.inputMode}
                autoComplete={newPassword && name === "password" ? "new-password" : f.autoComplete}
                required
              />
            )}
          </Field>
        );
      })}
      <Button variant="primary" type="submit" disabled={pending} className="h-9 max-lg:h-11">
        {pending ? "Please wait…" : submit}
      </Button>
      {footer ? <div className="text-center text-sm text-ink-3">{footer}</div> : null}
    </form>
  );
}
