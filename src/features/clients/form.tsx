"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ClientRow } from "@/features/misc/queries";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only what's needed to work with a client; no extra personal data. */
export function ClientDialog({ client, open, onOpenChange }: { client?: ClientRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { org } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const next: Record<string, string> = {};
    if (!v("name")) next.name = "Enter the client’s name.";
    if (v("email") && !EMAIL.test(v("email"))) next.email = "That doesn’t look like an email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const row = {
      name: v("name"),
      industry: v("industry"),
      contact_name: v("contact"),
      contact_role: v("role"),
      email: v("email").toLowerCase() || null,
      phone: v("phone") || null,
      notes: v("notes"),
    };
    setSaving(true);
    const db = supabaseBrowser().from("clients");
    const { data, error } = client
      ? await db.update(row).eq("id", client.id).select("id").single()
      : await db.insert({ ...row, organization_id: org.id }).select("id").single();
    setSaving(false);
    if (error || !data) return setErrors({ form: friendlyError(error, "save the client") });
    onOpenChange(false);
    toast({ message: client ? "Client saved" : `${row.name} added` });
    if (!client) router.push(`?client=${data.id}`, { scroll: false });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={client ? `Edit ${client.name}` : "Add client"}
        footer={
          <>
            <Button onClick={() => onOpenChange(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="primary" type="submit" form="client-form" disabled={saving} className="max-lg:h-11">{client ? "Save" : "Add client"}</Button>
          </>
        }
      >
        <form id="client-form" onSubmit={submit} noValidate className="grid grid-cols-2 gap-3">
          {errors.form ? <p role="alert" className="col-span-2 text-sm text-danger-ink">{errors.form}</p> : null}
          <Field label="Company or client name" error={errors.name} className="col-span-2">
            {(p) => <Input {...p} name="name" defaultValue={client?.name} maxLength={120} autoFocus />}
          </Field>
          <Field label="Industry">{(p) => <Input {...p} name="industry" defaultValue={client?.industry} maxLength={60} placeholder="e.g. Retail" />}</Field>
          <Field label="Main contact">{(p) => <Input {...p} name="contact" defaultValue={client?.contactName} maxLength={120} />}</Field>
          <Field label="Contact’s role">{(p) => <Input {...p} name="role" defaultValue={client?.contactRole ?? ""} maxLength={60} />}</Field>
          <Field label="Phone">{(p) => <Input {...p} name="phone" type="tel" defaultValue={client?.phone ?? ""} maxLength={40} />}</Field>
          <Field label="Email" error={errors.email} className="col-span-2">{(p) => <Input {...p} name="email" type="email" inputMode="email" defaultValue={client?.email ?? ""} />}</Field>
          <Field label="Notes" hint="Preferences, billing terms, renewal dates. No passwords." className="col-span-2">
            {(p) => <Textarea {...p} name="notes" rows={3} maxLength={5000} defaultValue={client?.notes ?? ""} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewClientButton() {
  const { can } = useOrg();
  const [open, setOpen] = useState(false);
  if (!can("clients.manage")) return null;
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="max-lg:h-11">
        <Plus aria-hidden className="size-[15px]" strokeWidth={2} />Add client
      </Button>
      <ClientDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
