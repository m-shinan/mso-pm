"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { HOME } from "@/lib/auth";

/** Any page outside an organization that fails to render. Never shows the raw error. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[mso-pm] page error", error.digest ?? "", error);
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="mb-1 inline-flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-ink">
        <AlertCircle aria-hidden className="size-6" strokeWidth={1.8} />
      </span>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-base leading-normal text-ink-3">
        We hit an unexpected problem loading this page. Try again, or go back to your dashboard.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={retry} className="max-lg:h-11">Try again</Button>
        <Link href={HOME} className={buttonClass("secondary", "md", "max-lg:h-11")}>Go to your dashboard</Link>
      </div>
      {error.digest ? (
        <p className="mt-4 text-xs text-ink-4">
          Still stuck? Report an issue from the account menu and mention <span className="font-mono text-ink-2">{error.digest}</span>.
        </p>
      ) : null}
    </main>
  );
}
