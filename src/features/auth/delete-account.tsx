"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { deleteAccount } from "./actions";

/** Danger-zone form: the button stays disabled until the email is retyped. */
export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
        <li>Your profile, sign-in and notification settings are deleted.</li>
        <li>You leave every organization and are signed out on all devices.</li>
        <li>Tasks, comments and files you created stay with their organization, without your name.</li>
      </ul>
      {state.error ? <ErrorState message={state.error} /> : null}
      <Field
        label={<>Type <span className="font-mono font-normal text-ink-2">{email}</span> to confirm</>}
        error={state.fieldErrors?.email}
      >
        {(p) => <Input {...p} name="email" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}
      </Field>
      <div className="flex justify-end">
        <Button variant="danger" type="submit" disabled={!matches || pending} className="max-lg:h-11 max-lg:w-full">
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </form>
  );
}
