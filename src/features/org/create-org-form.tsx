"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "agency",
    title: "Software agency defaults",
    note: "recommended",
    rows: [
      ["Project types", "E-commerce, ERP, Digital menu, LMS, Website, Mobile app, Web app, Custom"],
      ["Task statuses", "Backlog → Todo → In progress → Review → Testing → Done, plus Blocked"],
      ["Priorities", "Low, Medium, High, Urgent"],
      ["Severities", "Low, Medium, High, Critical"],
    ],
  },
  { id: "minimal", title: "Minimal", note: null, rows: [["", "Todo, In progress, Done. Add your own types and workflow later."]] },
] as const;

export const TIMEZONES = ["Asia/Dubai", "Asia/Kolkata", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat", "Europe/London", "UTC"];

const noSubscribe = () => () => {};

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function CreateOrgForm({ first }: { first?: boolean }) {
  const router = useRouter();
  const [template, setTemplate] = useState<string>("agency");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The browser's timezone (server render assumes UTC), unless the user picks one.
  const detectedTz = useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "UTC");
  const [pickedTz, setTz] = useState<string | null>(null);
  const tz = pickedTz ?? detectedTz;
  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (!name.trim()) return setNameError("Give the organization a name.");
    if (!/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(effectiveSlug)) return setError("The URL can use lowercase letters, numbers and dashes.");
    setBusy(true);
    const { data, error: dbError } = await supabaseBrowser().rpc("create_organization", {
      p_name: name.trim(),
      p_slug: effectiveSlug,
      p_template: template,
      p_timezone: String(d.get("timezone")),
      p_week_start: Number(d.get("week")),
    });
    if (dbError || !data) {
      setBusy(false);
      return setError(friendlyError(dbError, "create the organization"));
    }
    router.replace(`/${data.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex w-full max-w-[600px] flex-col rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-1.5 px-5 pt-6 lg:px-7">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{first ? "Create your first organization" : "Create an organization"}</h1>
        <p className="text-base leading-normal text-ink-3">
          A separate space with its own projects, clients, team and settings. You’ll be the owner, and you keep the same login.
        </p>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        {error ? <ErrorState message={error} /> : null}
        <div className="flex items-end gap-4">
          <span aria-hidden className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#2F6B5E] text-[22px] font-semibold text-white">
            {name.trim()[0]?.toUpperCase() ?? "?"}
          </span>
          <Field label="Organization name" error={nameError} className="grow">
            {(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setNameError(undefined); }} placeholder="e.g. Northfield Studio" autoFocus />}
          </Field>
        </div>
        <Field label="URL" hint={`Your pages will live at /${effectiveSlug || "…"}`}>
          {(p) => (
            <Input
              {...p}
              value={effectiveSlug}
              maxLength={40}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); setError(undefined); }}
            />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timezone" hint="Decides what “today” and “overdue” mean.">
            {(p) => (
              <Select {...p} name="timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
                {[...new Set([tz, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Week starts on">
            {(p) => (
              <Select {...p} name="week" defaultValue="1">
                <option value="1">Monday</option>
                <option value="0">Sunday</option>
                <option value="6">Saturday</option>
              </Select>
            )}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[12.5px] font-medium">Start with</legend>
          {TEMPLATES.map((t) => (
            <label key={t.id} className={cn("flex cursor-pointer gap-3 rounded-[10px] p-3.5", template === t.id ? "border-[1.5px] border-accent bg-selected" : "border border-line")}>
              <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="mt-0.5 accent-accent" />
              <span className="flex min-w-0 flex-col gap-2">
                <span className="text-base font-semibold">
                  {t.title}
                  {t.note ? <span className="font-normal text-ink-3"> · {t.note}</span> : null}
                </span>
                <span className="grid grid-cols-[96px_minmax(0,1fr)] gap-y-1 text-[12.5px] leading-snug max-sm:grid-cols-1">
                  {t.rows.map(([k, v]) => (
                    <span key={k + v} className="contents">
                      {k ? <span className="text-ink-4">{k}</span> : null}
                      <span className={k ? "" : "col-span-2 text-ink-3"}>{v}</span>
                    </span>
                  ))}
                </span>
              </span>
            </label>
          ))}
          <span className="text-xs text-ink-4">Everything here can be renamed, reordered or archived later in Settings.</span>
        </fieldset>
      </div>
      <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4 lg:px-7 max-lg:[&>*]:flex-1">
        <Button variant="primary" type="submit" disabled={busy} className="max-lg:h-11">{busy ? "Creating…" : "Create organization"}</Button>
      </div>
    </form>
  );
}
