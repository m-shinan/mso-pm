"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";

export const EMAIL_CATEGORIES = [
  { key: "email_assignments", label: "Assignments", hint: "A task or issue is assigned to you" },
  { key: "email_reviews", label: "Reviews", hint: "Work is ready for review, approved, or needs changes" },
  { key: "email_deadlines", label: "Deadlines", hint: "Your tasks due tomorrow, and overdue ones" },
  { key: "email_comments", label: "Comments", hint: "Someone comments on your work" },
  { key: "email_projects", label: "Projects & team", hint: "You’re added to a project, its status changes, an invitation is accepted" },
  { key: "email_chat", label: "Chat", hint: "New direct and group messages while you’re away" },
] as const;

export type EmailPrefKey = "email_notifications" | (typeof EMAIL_CATEGORIES)[number]["key"];
export type EmailPrefs = Record<EmailPrefKey, boolean>;

/** Per-category email switches. Account and security emails always go out, so they aren't listed. */
export function EmailPreferences({ userId, initial }: { userId: string; initial: EmailPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const toast = useToast();

  async function set(key: EmailPrefKey, on: boolean) {
    setPrefs((p) => ({ ...p, [key]: on }));
    const patch: Partial<EmailPrefs> = { [key]: on };
    const { error } = await supabaseBrowser().from("profiles").update(patch).eq("id", userId);
    if (error) {
      setPrefs((p) => ({ ...p, [key]: !on }));
      toast({ message: friendlyError(error, "save that") });
    }
  }

  return (
    <div className="flex flex-col">
      <Toggle label="Email me about activity" hint="Turn off to stop every email below" checked={prefs.email_notifications} onChange={(on) => set("email_notifications", on)} strong />
      <div className="mt-1 flex flex-col border-t border-line-soft pt-1">
        {EMAIL_CATEGORIES.map((c) => (
          <Toggle key={c.key} label={c.label} hint={c.hint} checked={prefs[c.key]} disabled={!prefs.email_notifications} onChange={(on) => set(c.key, on)} />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-4">Sign-in codes, password changes and other account emails are always sent.</p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
  strong,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  strong?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 py-2.5 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <span className="flex min-w-0 grow flex-col">
        <span className={strong ? "text-md font-medium" : "text-base"}>{label}</span>
        <span className="text-xs text-ink-4">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}
