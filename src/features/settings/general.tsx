"use client";

import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { OrgLogo } from "@/components/shell/org-switcher";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function GeneralSettings() {
  const { org, can } = useOrg();
  const toast = useToast();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string>();
  const editable = can("settings.manage");

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) {
      setError("The organization needs a name.");
      return;
    }
    toast({ message: "Settings saved · sample data, not persisted yet" });
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex max-w-lg flex-col gap-5" noValidate>
        <h1 className="text-2xl font-semibold">General</h1>
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <OrgLogo org={org} size={56} />
            {editable ? <button type="button" className="text-xs text-accent">Change logo</button> : null}
          </div>
          <Field label="Organization name" error={error} className="grow">
            {(p) => <Input {...p} name="name" defaultValue={org.name} disabled={!editable} onChange={() => setError(undefined)} />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timezone" hint="Used for due dates and “today”.">
            {(p) => (
              <Select {...p} name="timezone" defaultValue="Asia/Dubai" disabled={!editable}>
                {["Asia/Dubai", "Asia/Kolkata", "Asia/Riyadh", "Europe/London", "UTC"].map((tz) => <option key={tz}>{tz}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Week starts on">
            {(p) => (
              <Select {...p} name="week" defaultValue="monday" disabled={!editable}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
                <option value="saturday">Saturday</option>
              </Select>
            )}
          </Field>
        </div>
        {editable ? <Button variant="primary" type="submit" className="self-start max-lg:h-11">Save changes</Button> : null}
      </form>

      {org.role === "owner" ? (
        <section className="flex max-w-lg flex-col gap-2 border-t border-line pt-6">
          <h2 className="text-md font-semibold">Archive organization</h2>
          <p className="text-sm leading-normal text-ink-3">
            Hides {org.name} for every member. Nothing is deleted; an owner can restore it within 30 days, after which it can be permanently deleted.
          </p>
          <Button variant="secondary" className="self-start text-danger-ink max-lg:h-11" onClick={() => setArchiveOpen(true)}>Archive organization…</Button>
        </section>
      ) : null}

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${org.name}?`}
        actionLabel="Archive organization"
        confirmText={org.slug}
        onConfirm={() => toast({ message: "Archive is not connected yet · sample data" })}
      >
        <p>All projects, tasks and issues become read-only and disappear from every member’s switcher. You can restore it for 30 days.</p>
      </ConfirmDialog>
    </div>
  );
}
