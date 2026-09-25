"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phase 2 wires this to Supabase Auth (email + password, reset, verification). */
export function LoginForm() {
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<string>();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const next = {
      email: !email ? "Enter your email." : !EMAIL.test(email) ? "That doesn’t look like an email address." : undefined,
      password: !password ? "Enter your password." : undefined,
    };
    setErrors(next);
    if (next.email || next.password) return;
    setNotice("Sign-in isn’t connected yet. Open the demo organization instead.");
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[380px] flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-1">
        <span aria-hidden className="mb-2 inline-flex size-9 items-center justify-center rounded-lg bg-ink text-[15px] font-semibold text-white">m</span>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Sign in to mso-pm</h1>
        <p className="text-sm text-ink-3">One account for all your organizations.</p>
      </div>
      {notice ? <ErrorState message={notice} action={<Link href="/" className="text-sm font-medium text-accent">Open demo</Link>} /> : null}
      <Field label="Email" error={errors.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" />}
      </Field>
      <Field label={<span className="flex w-full justify-between">Password <Link href="/login?reset=1" className="font-normal text-accent">Forgot?</Link></span>} error={errors.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
      </Field>
      <Button variant="primary" type="submit" className="h-9 max-lg:h-11">Sign in</Button>
      <p className="text-center text-sm text-ink-3">
        New here? <Link href="/login?signup=1" className="text-accent">Create an account</Link>
      </p>
    </form>
  );
}
