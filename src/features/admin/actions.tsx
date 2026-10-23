"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

function useAdminCall() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  async function run(call: () => PromiseLike<{ error: unknown }>, done: string, what: string) {
    setPending(true);
    const { error } = await call();
    setPending(false);
    if (error) toast({ message: friendlyError(error, what) });
    else {
      toast({ message: done });
      router.refresh();
    }
  }
  return { run, pending };
}

/** Suspend / restore / delete one account. Deleting needs the email typed. */
export function UserActions({ id, email, suspended, isSelf }: { id: string; email: string; suspended: boolean; isSelf: boolean }) {
  const { run, pending } = useAdminCall();
  const [confirm, setConfirm] = useState<null | "suspend" | "delete">(null);
  const db = supabaseBrowser();
  if (isSelf) return <span className="text-xs text-ink-4">You</span>;
  return (
    <div className="flex justify-end gap-1.5">
      {suspended ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => db.rpc("admin_set_user_suspended", { p_user: id, p_suspended: false }), `${email} can sign in again`, "restore the account")}>
          Restore
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => setConfirm("suspend")}>Suspend</Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm("delete")} className="text-danger-ink">Delete</Button>
      <ConfirmDialog
        open={confirm === "suspend"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Suspend ${email}?`}
        actionLabel="Suspend account"
        onConfirm={() => run(() => db.rpc("admin_set_user_suspended", { p_user: id, p_suspended: true }), `${email} is suspended`, "suspend the account")}
      >
        They’re signed out everywhere and can’t sign in until you restore them. Their data stays as it is.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${email}?`}
        actionLabel="Delete account"
        confirmText={email}
        onConfirm={() => run(() => db.rpc("admin_delete_user", { p_user: id }), `${email} was deleted`, "delete the account")}
      >
        This permanently removes the account. Their work stays with their organizations, without their name. Type the email to confirm.
      </ConfirmDialog>
    </div>
  );
}

export function OrganizationActions({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const { run, pending } = useAdminCall();
  const [confirm, setConfirm] = useState(false);
  const db = supabaseBrowser();
  return (
    <div className="flex justify-end">
      {archived ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => db.rpc("admin_set_organization_archived", { p_org: id, p_archived: false }), `${name} is restored`, "restore the organization")}>
          Restore
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => setConfirm(true)}>Archive</Button>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Archive ${name}?`}
        actionLabel="Archive organization"
        onConfirm={() => run(() => db.rpc("admin_set_organization_archived", { p_org: id, p_archived: true }), `${name} is archived`, "archive the organization")}
      >
        Members lose access until it’s restored. Nothing is deleted.
      </ConfirmDialog>
    </div>
  );
}

/** Grant or revoke platform-admin access by email. */
export function PlatformAdminForm() {
  const { run, pending } = useAdminCall();
  const [email, setEmail] = useState("");
  const db = supabaseBrowser();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void run(() => db.rpc("admin_set_platform_admin", { p_email: email.trim(), p_admin: true }), `${email.trim()} is now a platform admin`, "add the admin").then(() => setEmail(""));
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="flex min-w-[240px] grow flex-col gap-1.5 text-[12.5px] font-medium">
        Add a platform admin
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.org" />
      </label>
      <Button type="submit" variant="primary" disabled={!valid || pending} className="max-lg:h-11">Add admin</Button>
    </form>
  );
}

export function RevokeAdminButton({ email }: { email: string }) {
  const { run, pending } = useAdminCall();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => supabaseBrowser().rpc("admin_set_platform_admin", { p_email: email, p_admin: false }), `${email} is no longer an admin`, "remove the admin")}>
      Remove admin
    </Button>
  );
}
