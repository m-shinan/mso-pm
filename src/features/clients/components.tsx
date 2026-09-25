"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { useState } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import { TableHead } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { StatusDot } from "@/components/domain/markers";
import { friendlyError } from "@/lib/errors";
import { formatDate, timeAgo } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/features/misc/queries";
import { ClientDialog, NewClientButton } from "./form";

const COLS = "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_100px_110px]";

export function ClientList({ clients, selectedId }: { clients: ClientRow[]; selectedId: string | null }) {
  const { org } = useOrg();
  const pathname = usePathname();
  if (clients.length === 0) {
    return (
      <EmptyState icon={Briefcase} title="No clients yet" action={<NewClientButton />}>
        Add the companies you build for, then link projects to them. Only {org.name} members can see them.
      </EmptyState>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <TableHead className={cn(COLS, "border-t-0")}>
        <span>Client</span><span>Main contact</span><span>Projects</span><span className="text-right">Last activity</span>
      </TableHead>
      {clients.map((c) => {
        const active = c.projects.length;
        return (
          <Link
            key={c.id}
            href={`${pathname}?client=${c.id}`}
            scroll={false}
            aria-current={selectedId === c.id ? "true" : undefined}
            className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-line-soft px-4 py-3 hover:bg-sunken lg:h-14 lg:py-0", COLS, selectedId === c.id && "bg-[#F3F6FD]")}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[7px] bg-subtle text-xs font-semibold text-ink-2">{c.name[0]}</span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium max-lg:text-[14.5px]">{c.name}</span>
                <span className="text-xs text-ink-4">{c.industry}<span className="lg:hidden"> · {c.contactName}</span></span>
              </span>
            </span>
            <span className="hidden min-w-0 flex-col lg:flex">
              <span className="truncate">{c.contactName}</span>
              <span className="truncate text-xs text-ink-4">{c.contactRole}</span>
            </span>
            <span className="text-sm max-lg:text-xs max-lg:text-ink-4">{active} {active === 1 ? "project" : "projects"}</span>
            <span suppressHydrationWarning className="hidden text-right text-[12.5px] text-ink-4 lg:block">{timeAgo(c.lastActivity)}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function ClientDrawer({ client }: { client: ClientRow | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { config, can, href } = useOrg();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  if (!client) return null;

  async function archive() {
    const { error } = await supabaseBrowser()
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", client!.id)
      .select("id")
      .single();
    if (error) return toast({ message: friendlyError(error, "archive the client") });
    toast({ message: `${client!.name} archived. Their projects keep the link.` });
    router.push(pathname, { scroll: false });
    router.refresh();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && router.push(pathname, { scroll: false })}>
      <DrawerContent
        label={client.name}
        header={
          <>
            <span className="text-[12.5px] text-ink-3">Client</span>
            <span className="grow" />
            {can("clients.manage") ? (
              <>
                <Button size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={archive} className="text-danger-ink">Archive</Button>
                <ClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
              </>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-5 px-6 py-5">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-[10px] bg-subtle text-xl font-semibold text-ink-2">{client.name[0]}</span>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-semibold">{client.name}</h2>
              <span className="text-[12.5px] text-ink-4">{client.industry}</span>
            </div>
          </div>
          <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-ink-4">Contact</dt>
            <dd>{client.contactName}{client.contactRole ? <span className="text-ink-4"> · {client.contactRole}</span> : null}</dd>
            <dt className="text-ink-4">Email</dt>
            <dd>{client.email ? <a href={`mailto:${client.email}`} className="text-accent">{client.email}</a> : <span className="text-ink-4">Not added</span>}</dd>
            <dt className="text-ink-4">Phone</dt>
            <dd>{client.phone ? <a href={`tel:${client.phone}`} className="text-accent">{client.phone}</a> : <span className="text-ink-4">Not added</span>}</dd>
          </dl>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Projects <span className="font-normal text-ink-4">{client.projects.length}</span></h3>
            <div className="overflow-hidden rounded-lg border border-line">
              {client.projects.map((p) => (
                <Link key={p.id} href={href(`/projects/${p.key.toLowerCase()}`)} className="flex items-center gap-2.5 border-t border-line-soft px-3 py-2.5 first:border-t-0 hover:bg-sunken">
                  <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-md bg-subtle text-[11px] font-semibold text-ink-2">{p.name[0]}</span>
                  <span className="flex grow flex-col">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-ink-4">{config.get(p.typeId)?.name}{p.dueDate ? ` · due ${formatDate(p.dueDate)}` : ""}</span>
                  </span>
                  <StatusDot option={config.get(p.statusId)} className="text-[12.5px]" />
                </Link>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            {client.notes ? (
              <div className="rounded-lg border border-line px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line text-[#2A2A30]">{client.notes}</div>
            ) : (
              <p className="text-sm text-ink-4">No notes.</p>
            )}
          </section>
        </div>
      </DrawerContent>
    </Dialog>
  );
}
