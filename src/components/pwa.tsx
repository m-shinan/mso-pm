"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { initInstallPrompt, promptInstall, useInstallState } from "@/lib/install-prompt";

/** Mounted once in the root layout: registers the service worker and listens for the install prompt. */
export function PwaSetup() {
  useEffect(() => {
    initInstallPrompt();
    // Only in production: in development the worker would cache stale pages.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

/** Steps for Safari on iPhone/iPad, which has no install prompt. */
export function IosInstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Install mso-pm" description="Add it to your Home Screen to open it like an app.">
        <ol className="flex flex-col gap-3 text-base">
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle"><Share aria-hidden className="size-4" /></span>
            Tap <strong className="font-semibold">Share</strong> in Safari’s toolbar.
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle"><SquarePlus aria-hidden className="size-4" /></span>
            Choose <strong className="font-semibold">Add to Home Screen</strong>, then <strong className="font-semibold">Add</strong>.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/** "Install app" button; hidden when already installed or the browser can't install. */
export function InstallAppButton({ className }: { className?: string }) {
  const state = useInstallState();
  const [ios, setIos] = useState(false);
  if (state === "installed" || state === "unavailable") return null;
  return (
    <>
      <Button className={className} onClick={() => (state === "ios" ? setIos(true) : void promptInstall())}>
        <Download aria-hidden className="size-4" /> Install app
      </Button>
      <IosInstallDialog open={ios} onOpenChange={setIos} />
    </>
  );
}
