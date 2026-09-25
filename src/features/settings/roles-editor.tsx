"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { PERMISSION_LABELS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabase/client";

interface RoleItem {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  is_system: boolean;
  members: number;
}

function toKey(name: string) {
  return name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "role";
}

/**
 * Permissions per role. The owner role is fixed (someone must always have
 * everything); every other role — built-in or custom — can be edited.
 */
export function RolesEditor({ initial }: { initial: RoleItem[] }) {
  const { org, can } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const editable = can("settings.manage");
  const [roles, setRoles] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<RoleItem | null>(null);
  const [error, setError] = useState<string>();

  async function toggle(role: RoleItem, perm: Permission) {
    const on = !role.permissions.includes(perm);
    const permissions = on ? [...role.permissions, perm] : role.permissions.filter((p) => p !== perm);
    const before = roles;
    setRoles((all) => all.map((r) => (r.id === role.id ? { ...r, permissions } : r)));
    const { error: dbError } = await supabaseBrowser().from("roles").update({ permissions }).eq("id", role.id).select("id").single();
    if (dbError) {
      setRoles(before);
      toast({ message: friendlyError(dbError, "change the role") });
    } else router.refresh();
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get("name") ?? "").trim();
    if (!name) return setError("Name the role.");
    const base = roles.find((r) => r.id === d.get("base"));
    let key = toKey(name);
    if (roles.some((r) => r.key === key)) key = `${key}_${roles.length}`;
    const { data, error: dbError } = await supabaseBrowser()
      .from("roles")
      .insert({ organization_id: org.id, key, name, permissions: base?.permissions ?? [] })
      .select("id, key, name, permissions, is_system")
      .single();
    if (dbError || !data) return setError(friendlyError(dbError, "create the role"));
    setRoles((all) => [...all, { ...data, members: 0 }]);
    setCreating(false);
    setError(undefined);
    router.refresh();
  }

  async function remove(role: RoleItem) {
    const { error: dbError } = await supabaseBrowser().from("roles").delete().eq("id", role.id).select("id").single();
    if (dbError) return toast({ message: role.members ? "People still have this role. Give them another role first." : friendlyError(dbError, "delete the role") });
    setRoles((all) => all.filter((r) => r.id !== role.id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1.5">
          <h1 className="text-2xl font-semibold">Roles &amp; permissions</h1>
          <p className="text-base leading-normal text-ink-3">
            What each role can do in {org.name}. Everyone can read the projects they’re a member of. A person can also get a different role on a
            single project (from the project’s People dialog). The database enforces all of this.
          </p>
        </div>
        {editable ? <Button variant="primary" onClick={() => setCreating(true)} className="max-lg:h-11"><Plus aria-hidden className="size-[15px]" strokeWidth={2} />New role</Button> : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-sunken text-xs text-ink-4">
            <tr>
              <th scope="col" className="sticky left-0 bg-sunken px-3.5 py-2 text-left font-medium">Permission</th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-2 py-2 align-bottom font-medium">
                  <span className="block text-ink-2">{r.name}</span>
                  <span className="block font-normal">{r.members} {r.members === 1 ? "person" : "people"}</span>
                  {editable && !r.is_system ? (
                    <button type="button" onClick={() => setDeleting(r)} className="mt-1 text-2xs text-danger-ink hover:underline">Delete</button>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p} className="border-t border-line-soft">
                <th scope="row" className="sticky left-0 bg-surface px-3.5 py-2 text-left font-normal">
                  <span className="block text-ink">{PERMISSION_LABELS[p]}</span>
                  <span className="font-mono text-2xs text-ink-4">{p}</span>
                </th>
                {roles.map((r) => {
                  const has = r.permissions.includes(p);
                  const locked = !editable || r.key === "owner";
                  return (
                    <td key={r.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={locked}
                        onChange={() => toggle(r, p)}
                        aria-label={`${r.name}: ${PERMISSION_LABELS[p]}`}
                        className="size-4 accent-accent disabled:opacity-60 max-lg:size-5"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-4">The Owner role always has every permission and can’t be changed.</p>

      <Dialog open={creating} onOpenChange={(v) => { setCreating(v); setError(undefined); }}>
        <DialogContent
          title="New role"
          footer={
            <>
              <Button onClick={() => setCreating(false)} className="max-lg:h-11">Cancel</Button>
              <Button variant="primary" type="submit" form="new-role" className="max-lg:h-11">Create role</Button>
            </>
          }
        >
          <form id="new-role" onSubmit={create} noValidate className="flex flex-col gap-3">
            <Field label="Name" error={error}>{(p) => <Input {...p} name="name" maxLength={40} autoFocus placeholder="e.g. QA tester, Client" />}</Field>
            <Field label="Start from" hint="Copies that role’s permissions; adjust them in the table after.">
              {(p) => (
                <Select {...p} name="base" defaultValue={roles.find((r) => r.key === "viewer")?.id}>
                  {roles.filter((r) => r.key !== "owner").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              )}
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)} title={`Delete the “${deleting?.name}” role?`} actionLabel="Delete role" onConfirm={() => deleting && remove(deleting)}>
        <p>{deleting?.members ? `${deleting.members} people have it; change their role first.` : "Nobody has this role, so nothing else changes."}</p>
      </ConfirmDialog>
    </div>
  );
}
