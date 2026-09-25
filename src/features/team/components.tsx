"use client";

import { Check, Copy, MoreHorizontal, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { TableHead } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { formatDate, timeAgo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createInvitations } from "./actions";
import type { InvitationRow, RoleRow } from "./queries";

const COLS = "lg:grid-cols-[minmax(0,1.6fr)_170px_minmax(0,1.4fr)_100px_110px_32px]";

export function MemberTable({ members, roles }: { members: (Member & { projectNames: string[] })[]; roles: RoleRow[] }) {
  const { can, currentUserId, org } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const manage = can("members.manage");
  const [removing, setRemoving] = useState<Member | null>(null);
  const assignable = roles.filter((r) => r.key !== "owner" || org.role === "owner");

  async function changeRole(m: Member, roleId: string) {
    const { error } = await supabaseBrowser()
      .from("organization_members")
      .update({ role_id: roleId })
      .eq("organization_id", org.id)
      .eq("user_id", m.id)
      .select("user_id")
      .single();
    if (error) return toast({ message: friendlyError(error, "change the role") });
    toast({ message: `${m.name} is now ${roles.find((r) => r.id === roleId)?.name}` });
    router.refresh();
  }

  async function remove(m: Member) {
    const { error } = await supabaseBrowser()
      .from("organization_members")
      .delete()
      .eq("organization_id", org.id)
      .eq("user_id", m.id)
      .select("user_id")
      .single();
    if (error) return toast({ message: friendlyError(error, "remove the member") });
    toast({ message: m.id === currentUserId ? `You left ${org.name}` : `${m.name} removed` });
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={removing?.id === currentUserId ? `Leave ${org.name}?` : `Remove ${removing?.name} from ${org.name}?`}
        actionLabel={removing?.id === currentUserId ? "Leave organization" : "Remove member"}
        onConfirm={() => removing && remove(removing)}
      >
        <p>
          {removing?.id === currentUserId ? "You" : "They"} lose access to every {org.name} project straight away. Tasks stay, unassigned.
          The account and other organizations are not affected.
        </p>
      </ConfirmDialog>
      <TableHead className={cn(COLS, "border-t-0")}>
        <span>Member</span><span>Role</span><span>Projects</span><span>Status</span><span>Joined</span><span />
      </TableHead>
      {members.map((m) => {
        const self = m.id === currentUserId;
        const editable = manage && !self && (m.role !== "owner" || org.role === "owner");
        return (
          <div key={m.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-line-soft px-4 py-3 lg:h-14 lg:py-0", COLS)}>
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar person={m} size="lg" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{m.name}{self ? <span className="font-normal text-ink-4"> (you)</span> : null}</span>
                <span className="truncate text-xs text-ink-4">{m.email}</span>
              </span>
            </span>
            {editable ? (
              <Select aria-label={`Role for ${m.name}`} value={m.roleId} onChange={(e) => changeRole(m, e.target.value)} className="h-8 text-[12.5px] max-lg:h-10">
                {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            ) : (
              <span className="text-sm max-lg:text-xs max-lg:text-ink-3">{m.roleName}</span>
            )}
            <span className="hidden truncate text-[12.5px] text-ink-2 lg:block">
              {["owner", "admin", "project_manager"].includes(m.role) ? "All projects" : m.projectNames.join(", ") || "No projects yet"}
            </span>
            <span className="hidden items-center gap-1.5 text-[12.5px] lg:flex">
              <span aria-hidden className={cn("size-[7px] rounded-full", m.status === "active" ? "bg-success" : "bg-ink-6")} />
              {m.status === "active" ? "Active" : "Deactivated"}
            </span>
            <span className="hidden text-[12.5px] text-ink-4 lg:block">{formatDate(m.joinedAt.slice(0, 10), { year: true })}</span>
            {editable || self ? (
              <Menu>
                <MenuTrigger aria-label={`Actions for ${m.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-ink-4 hover:bg-subtle max-lg:col-start-2 max-lg:row-start-1 max-lg:size-10">
                  <MoreHorizontal aria-hidden className="size-4" />
                </MenuTrigger>
                <MenuContent align="end" label="Member actions">
                  <MenuItem destructive onSelect={() => setRemoving(m)}>{self ? "Leave organization…" : "Remove from organization…"}</MenuItem>
                </MenuContent>
              </Menu>
            ) : <span className="hidden lg:block" />}
          </div>
        );
      })}
    </div>
  );
}

export function PendingInvites({ invites }: { invites: InvitationRow[] }) {
  const router = useRouter();
  const toast = useToast();
  if (invites.length === 0) return null;

  async function revoke(id: string) {
    const { error } = await supabaseBrowser().from("invitations").update({ status: "revoked" }).eq("id", id).select("id").single();
    if (error) return toast({ message: friendlyError(error, "revoke the invitation") });
    toast({ message: "Invitation revoked" });
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink-2">Pending invitations <span className="font-normal text-ink-4">{invites.length}</span></h2>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {invites.map((i) => {
          const expired = new Date(i.expires_at) < new Date();
          return (
            <div key={i.id} className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0">
              <span className="inline-block size-[30px] shrink-0 rounded-full border-[1.5px] border-dashed border-ink-6" />
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate font-medium">{i.email}</span>
                <span suppressHydrationWarning className={cn("text-xs", expired ? "text-late" : "text-ink-4")}>
                  {i.role?.name} · sent {timeAgo(i.created_at)}{expired ? " · expired" : ""}
                </span>
              </span>
              <Button size="sm" onClick={() => revoke(i.id)} className="max-lg:h-10">Revoke</Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteButton({ roles }: { roles: RoleRow[] }) {
  const { org, can } = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [roleId, setRoleId] = useState(() => roles.find((r) => r.key === "developer")?.id ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<{ email: string; url: string }[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!can("members.invite")) return null;
  const invitable = roles.filter((r) => r.key !== "owner");

  function addDraft() {
    const value = draft.trim().replace(/,$/, "").toLowerCase();
    if (!value) return true;
    if (!EMAIL.test(value)) {
      setError(`“${value}” isn’t a valid email address.`);
      return false;
    }
    if (!emails.includes(value)) setEmails([...emails, value]);
    setDraft("");
    setError(undefined);
    return true;
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addDraft();
    } else if (e.key === "Backspace" && !draft && emails.length) {
      setEmails(emails.slice(0, -1));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const d = draft.trim().toLowerCase();
    if (d && !EMAIL.test(d)) return setError(`“${d}” isn’t a valid email address.`);
    const all = d && !emails.includes(d) ? [...emails, d] : emails;
    if (all.length === 0) return setError("Add at least one email address.");
    setSaving(true);
    const res = await createInvitations({ organizationId: org.id, roleId, emails: all });
    setSaving(false);
    if (res.error) return setError(res.error);
    setLinks(res.links ?? []);
    setEmails([]);
    setDraft("");
    router.refresh();
  }

  function close(v: boolean) {
    setOpen(v);
    if (!v) {
      setLinks(null);
      setError(undefined);
    }
  }

  async function copy(url: string) {
    await navigator.clipboard?.writeText(url);
    setCopied(url);
  }

  const count = emails.length + (draft.trim() ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={close}>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />Invite people
      </Button>
      {links ? (
        <DialogContent
          title="Share the invite links"
          description="Each link works once, for that email address only, and expires in 7 days."
          footer={<Button variant="primary" onClick={() => close(false)} className="max-lg:h-11">Done</Button>}
        >
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.url} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <span className="flex min-w-0 grow flex-col">
                  <span className="text-sm font-medium">{l.email}</span>
                  <span className="truncate font-mono text-2xs text-ink-4">{l.url}</span>
                </span>
                <Button size="sm" onClick={() => copy(l.url)} className="max-lg:h-10">
                  {copied === l.url ? <><Check aria-hidden className="size-3.5" />Copied</> : <><Copy aria-hidden className="size-3.5" />Copy</>}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      ) : (
        <DialogContent
          title={`Invite people to ${org.name}`}
          description="You’ll get a link to send each person. Anyone with an existing account joins as soon as they accept."
          footer={
            <>
              <Button onClick={() => close(false)} className="max-lg:h-11">Cancel</Button>
              <Button variant="primary" type="submit" form="invite" disabled={saving} className="max-lg:h-11">
                {saving ? "Creating…" : `Create ${count || ""} invite${count === 1 ? "" : "s"}`}
              </Button>
            </>
          }
        >
          <form id="invite" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-email" className="text-[12.5px] font-medium">Email addresses</label>
              <div className={cn("flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-ring", error ? "border-danger-border" : "border-line-strong")}>
                {emails.map((e) => (
                  <span key={e} className="flex h-6 items-center gap-1 rounded bg-subtle pr-1 pl-2 text-[12.5px]">
                    {e}
                    <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))} className="inline-flex size-5 items-center justify-center rounded text-ink-4 hover:bg-muted">
                      <X aria-hidden className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="invite-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setError(undefined); }}
                  onKeyDown={onKey}
                  onBlur={addDraft}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "invite-error" : undefined}
                  placeholder={emails.length ? "Add another…" : "name@company.com"}
                  className="h-7 min-w-[140px] grow bg-transparent text-sm outline-none max-lg:h-9 max-lg:text-lg"
                />
              </div>
              {error ? <span id="invite-error" className="text-xs text-danger-ink">{error}</span> : null}
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="pb-1.5 text-[12.5px] font-medium">Role in {org.name}</legend>
              {invitable.map((r) => (
                <label key={r.id} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5", roleId === r.id ? "border-[1.5px] border-accent bg-selected" : "border border-line")}>
                  <input type="radio" name="role" value={r.id} checked={roleId === r.id} onChange={() => setRoleId(r.id)} className="mt-0.5 accent-accent" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="text-[12.5px] text-ink-3">{ROLE_HINTS[r.key] ?? `${r.permissions.length} permissions`}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

const ROLE_HINTS: Record<string, string> = {
  admin: "Manage members, settings and every project.",
  project_manager: "Create projects, assign work, manage releases.",
  developer: "Work on tasks and issues in projects they’re added to.",
  viewer: "Read-only, in projects they’re added to. Good for clients.",
};
