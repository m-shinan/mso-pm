"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { OrgLogo } from "@/components/shell/org-switcher";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { TIMEZONES } from "@/features/org/create-org-form";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export function GeneralSettings() {
  const { org, can } = useOrg();
  const router = useRouter();
  const toast = useToast();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const editable = can("settings.manage");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get("name") ?? "").trim();
    if (!name) return setError("The organization needs a name.");
    setSaving(true);
    const { error: dbError } = await supabaseBrowser()
      .from("organizations")
      .update({ name, timezone: String(d.get("timezone")), week_start: Number(d.get("week")) })
      .eq("id", org.id)
      .select("id")
      .single();
    setSaving(false);
    if (dbError) return toast({ message: friendlyError(dbError, "save the settings") });
    toast({ message: "Settings saved" });
    router.refresh();
  }

  async function archive() {
    const { error: dbError } = await supabaseBrowser().rpc("set_organization_archived", { p_org: org.id, p_archived: true });
    if (dbError) return toast({ message: friendlyError(dbError, "archive the organization") });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={save} className="flex max-w-lg flex-col gap-5" noValidate>
        <h1 className="text-2xl font-semibold">General</h1>
        <div className="flex items-end gap-4">
          <OrgLogo org={org} size={56} />
          <Field label="Organization name" error={error} className="grow">
            {(p) => <Input {...p} name="name" defaultValue={org.name} maxLength={80} disabled={!editable} onChange={() => setError(undefined)} />}
          </Field>
        </div>
        <p className="-mt-2 text-xs text-ink-4">URL: /{org.slug} (fixed, so shared links keep working)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timezone" hint="Used for due dates and “today”.">
            {(p) => (
              <Select {...p} name="timezone" defaultValue={org.timezone} disabled={!editable}>
                {[...new Set([org.timezone, ...TIMEZONES])].map((tz) => <option key={tz}>{tz}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Week starts on">
            {(p) => (
              <Select {...p} name="week" defaultValue={String(org.weekStart)} disabled={!editable}>
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </Select>
            )}
          </Field>
        </div>
        {editable ? <Button variant="primary" type="submit" disabled={saving} className="self-start max-lg:h-11">{saving ? "Saving…" : "Save changes"}</Button> : null}
      </form>

      {org.role === "owner" ? (
        <section className="flex max-w-lg flex-col gap-2 border-t border-line pt-6">
          <h2 className="text-md font-semibold">Archive organization</h2>
          <p className="text-sm leading-normal text-ink-3">
            Hides {org.name} for every member. Nothing is deleted, and an owner can restore it later.
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
        onConfirm={archive}
      >
        <p>Its projects, tasks and issues disappear from every member’s switcher until an owner restores it. Nothing is deleted.</p>
      </ConfirmDialog>
    </div>
  );
}
