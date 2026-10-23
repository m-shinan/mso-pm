"use client";

import { Check, Lightbulb, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/states";
import { friendlyError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type FeedbackKind = "feature" | "issue";

const COPY = {
  feature: {
    tab: "Request a feature",
    subject: "What would you like?",
    subjectHint: "Export a project to CSV",
    body: "Why would it help?",
    bodyHint: "What are you trying to do, and what do you do today instead?",
    submit: "Send request",
    subjectError: "Name the feature in a few words.",
  },
  issue: {
    tab: "Report an issue",
    subject: "What went wrong?",
    subjectHint: "Board doesn’t save when I drag a task",
    body: "Steps to reproduce",
    bodyHint: "1. Open a project board\n2. Drag a task to Done\n3. Reload: it is back in Todo",
    submit: "Send report",
    subjectError: "Give the problem a short title.",
  },
} as const;

const schema = (kind: FeedbackKind) =>
  z.object({
    subject: z.string().trim().min(1, COPY[kind].subjectError).max(120, "Keep it under 120 characters."),
    body: z.string().trim().min(10, "Tell us a little more, at least 10 characters.").max(5000, "Keep it under 5,000 characters."),
  });

/** Sends a feature request or issue report to the mso-pm team (not to the organization). */
export function FeedbackDialog({
  open,
  onOpenChange,
  kind,
  onKindChange,
  organizationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: FeedbackKind;
  onKindChange: (kind: FeedbackKind) => void;
  organizationId?: string;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const copy = COPY[kind];

  function reset() {
    setSubject("");
    setBody("");
    setErrors({});
    setFailed(null);
    setSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema(kind).safeParse({ subject, body });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      setErrors({ subject: f.subject?.[0], body: f.body?.[0] });
      return;
    }
    setErrors({});
    setFailed(null);
    setPending(true);
    // No .select(): senders can't read feedback back, only platform admins can.
    const { error } = await supabaseBrowser().from("feedback").insert({
      kind,
      subject: parsed.data.subject,
      body: parsed.data.body,
      page: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 300),
      organization_id: organizationId ?? null,
    });
    setPending(false);
    if (error) setFailed(friendlyError(error, "send this"));
    else setSent(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent title="Send feedback" description="Goes to the mso-pm team, not to your organization.">
        {sent ? (
          <div className="flex flex-col items-center gap-2.5 py-6 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-success/15 text-success-ink">
              <Check aria-hidden className="size-5" strokeWidth={2.2} />
            </span>
            <p className="text-md font-semibold">Thanks, we’ve got it</p>
            <p className="max-w-[340px] text-sm leading-normal text-ink-3">
              We read every message. If we need more detail we’ll reply to your account email.
            </p>
            <Button className="mt-2 max-lg:h-11" onClick={reset}>Send another</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="Type" className="flex gap-1 rounded-lg bg-subtle p-[3px]">
              {(["feature", "issue"] as const).map((k) => {
                const Icon = k === "feature" ? Lightbulb : TriangleAlert;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => {
                      onKindChange(k);
                      setErrors({});
                    }}
                    className={cn(
                      "inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium max-lg:h-10",
                      kind === k ? "bg-surface text-ink shadow-[0_1px_2px_rgb(20_20_24/0.12)]" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    <Icon aria-hidden className="size-[15px]" strokeWidth={1.9} />
                    {COPY[k].tab}
                  </button>
                );
              })}
            </div>
            {failed ? <ErrorState message={failed} /> : null}
            <Field label={copy.subject} error={errors.subject} hint={`${subject.length}/120`}>
              {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={copy.subjectHint} maxLength={120} autoFocus />}
            </Field>
            <Field label={copy.body} error={errors.body}>
              {(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} placeholder={copy.bodyHint} rows={5} maxLength={5000} />}
            </Field>
            {kind === "issue" ? (
              <p className="rounded-md border border-line-soft bg-sunken px-3 py-2 text-xs text-ink-3">
                The page you’re on and your browser name are sent with the report.
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button variant="primary" type="submit" disabled={pending} className="max-lg:h-11 max-lg:w-full">
                {pending ? "Sending…" : copy.submit}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
