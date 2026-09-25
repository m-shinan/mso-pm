"use client";

import { MoreHorizontal, Plus, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { TableHead } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Member, RoleKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLS = "lg:grid-cols-[minmax(0,1.6fr)_140px_minmax(0,1.4fr)_100px_110px_32px]";

export function MemberTable({ members }: { members: (Member & { projectNames: string[] })[] }) {
  const { can, currentUserId, org } = useOrg();
  const toast = useToast();
  const manage = can("members.manage");
  const [removing, setRemoving] = useState<Member | null>(null);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Remove ${removing?.name} from ${org.name}?`}
        actionLabel="Remove member"
        onConfirm={() => toast({ message: "Removing members is not connected yet · sample data" })}
      >
        <p>They lose access to every {org.name} project straight away. Their tasks stay, unassigned. Their account and other organizations are not affected.</p>
      </ConfirmDialog>
      <TableHead className={cn(COLS, "border-t-0")}>
        <span>Member</span><span>Role</span><span>Projects</span><span>Status</span><span>Last active</span><span />
      </TableHead>
      {members.map((m) => (
        <div key={m.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-line-soft px-4 py-3 lg:h-14 lg:py-0", COLS)}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar person={m} size="lg" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{m.name}{m.id === currentUserId ? <span className="font-normal text-ink-4"> (you)</span> : null}</span>
              <span className="truncate text-xs text-ink-4">{m.email ?? ROLE_LABELS[m.role]}</span>
            </span>
          </span>
          <span className="text-sm max-lg:text-xs max-lg:text-ink-3">{ROLE_LABELS[m.role]}</span>
          <span className="hidden truncate text-[12.5px] text-ink-2 lg:block">{m.role === "owner" || m.role === "admin" ? "All projects" : m.projectNames.join(", ") || "—"}</span>
          <span className="hidden items-center gap-1.5 text-[12.5px] lg:flex">
            <span aria-hidden className={cn("size-[7px] rounded-full", m.status === "active" ? "bg-[#2F8F5B]" : "bg-ink-6")} />
            {m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : "Deactivated"}
          </span>
          <span suppressHydrationWarning className="hidden text-[12.5px] text-ink-4 lg:block">{m.id === currentUserId ? "Now" : m.lastActive ? timeAgo(m.lastActive) : "—"}</span>
          {manage && m.id !== currentUserId && m.role !== "owner" ? (
            <Menu>
              <MenuTrigger aria-label={`Actions for ${m.name}`} className="hidden size-7 items-center justify-center rounded-md text-ink-4 hover:bg-subtle lg:inline-flex">
                <MoreHorizontal aria-hidden className="size-4" />
              </MenuTrigger>
              <MenuContent align="end" label="Member actions">
                <MenuItem destructive onSelect={() => setRemoving(m)}>Remove from organization…</MenuItem>
              </MenuContent>
            </Menu>
          ) : <span className="hidden lg:block" />}
        </div>
      ))}
    </div>
  );
}

const INVITE_ROLES: { key: RoleKey; desc: string }[] = [
  { key: "admin", desc: "Manage members, settings and every project." },
  { key: "project_manager", desc: "Create projects, assign work, manage releases." },
  { key: "developer", desc: "Work on tasks and issues in projects they’re added to." },
  { key: "viewer", desc: "Read-only. Good for clients or stakeholders." },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteButton() {
  const { org, can, projects } = useOrg();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<RoleKey>("developer");
  const [error, setError] = useState<string>();

  if (!can("members.invite")) return null;

  function addDraft() {
    const value = draft.trim().replace(/,$/, "");
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!addDraft()) return;
    const all = draft.trim() ? [...emails, draft.trim()] : emails;
    if (all.length === 0) {
      setError("Add at least one email address.");
      return;
    }
    setOpen(false);
    setEmails([]);
    // Phase 3: server action creates invitations with hashed tokens and sends the email.
    toast({ message: `${all.length} invite${all.length === 1 ? "" : "s"} ready · sample data, not sent yet` });
  }

  const count = emails.length + (draft.trim() ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />Invite people
      </Button>
      <DialogContent
        title={`Invite people to ${org.name}`}
        description="They get an email. People who already have an account join as soon as they accept."
        footer={
          <>
            <Button onClick={() => setOpen(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="invite" className="max-lg:h-11">
              Send {count || ""} invite{count === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <form id="invite" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-[12.5px] font-medium">Email addresses</label>
            <div className={cn("flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-ring", error ? "border-[#CC3A21]" : "border-line-strong")}>
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
            {INVITE_ROLES.map((r) => (
              <label key={r.key} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5", role === r.key ? "border-[1.5px] border-accent bg-[#F3F6FD]" : "border border-line")}>
                <input type="radio" name="role" value={r.key} checked={role === r.key} onChange={() => setRole(r.key)} className="mt-0.5 accent-accent" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{ROLE_LABELS[r.key]}</span>
                  <span className="text-[12.5px] text-ink-3">{r.desc}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-ink-4">Project access can be added after they join. {projects.length} projects in this organization.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
