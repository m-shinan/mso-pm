"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
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

export function CreateOrgForm() {
  const toast = useToast();
  const [template, setTemplate] = useState<string>("agency");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the organization a name.");
      return;
    }
    // Phase 2: a server action creates the org, makes you owner and seeds the chosen defaults in one transaction.
    toast({ message: `“${name.trim()}” would be created here · not connected yet` });
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex w-full max-w-[600px] flex-col rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-1.5 px-5 pt-6 lg:px-7">
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">Create an organization</h1>
        <p className="text-base leading-normal text-ink-3">
          A separate space with its own projects, clients, team and settings. You’ll be the owner, and you keep the same login.
        </p>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6 lg:px-7">
        <div className="flex items-end gap-4">
          <span aria-hidden className="inline-flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#2F6B5E] text-[22px] font-semibold text-white">
            {name.trim()[0]?.toUpperCase() ?? "?"}
          </span>
          <Field label="Organization name" error={error} className="grow">
            {(p) => <Input {...p} value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} placeholder="e.g. Northfield Studio" autoFocus />}
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Timezone">
            {(p) => (
              <Select {...p} defaultValue="Asia/Dubai">
                {["Asia/Dubai", "Asia/Kolkata", "Asia/Riyadh", "Europe/London", "UTC"].map((tz) => <option key={tz}>{tz}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Week starts on">
            {(p) => (
              <Select {...p} defaultValue="monday">
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
                <option value="saturday">Saturday</option>
              </Select>
            )}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[12.5px] font-medium">Start with</legend>
          {TEMPLATES.map((t) => (
            <label key={t.id} className={cn("flex cursor-pointer gap-3 rounded-[10px] p-3.5", template === t.id ? "border-[1.5px] border-accent bg-[#F3F6FD]" : "border border-line")}>
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
        <Button variant="primary" type="submit" className="max-lg:h-11">Create organization</Button>
      </div>
    </form>
  );
}
