"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
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
            <span>Tap <strong className="font-semibold">Share</strong> in Safari’s toolbar.</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle"><SquarePlus aria-hidden className="size-4" /></span>
            <span>Choose <strong className="font-semibold">Add to Home Screen</strong>, then <strong className="font-semibold">Add</strong>.</span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

// Closing the banner hides it for two weeks, per browser.
const BANNER_KEY = "install-banner-closed";
const BANNER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const bannerListeners = new Set<() => void>();

function bannerClosed() {
  try {
    return Date.now() - Number(localStorage.getItem(BANNER_KEY) ?? 0) < BANNER_SNOOZE_MS;
  } catch {
    return false;
  }
}

function closeBanner() {
  try {
    localStorage.setItem(BANNER_KEY, String(Date.now()));
  } catch {}
  bannerListeners.forEach((l) => l());
}

function subscribeBanner(cb: () => void) {
  bannerListeners.add(cb);
  return () => bannerListeners.delete(cb);
}

/**
 * "Install mso-pm" card at the top of the screen, like the browser's own install bar,
 * for phones and desktop Chrome/Edge (and Safari on iPhone, with the Share steps).
 * Mounted once in the root layout; hidden once installed or closed.
 */
export function InstallBanner() {
  const state = useInstallState();
  const closed = useSyncExternalStore(subscribeBanner, bannerClosed, () => true);
  const [ios, setIos] = useState(false);
  const show = !closed && (state === "prompt" || state === "ios");
  return (
    <>
      {show ? (
        <div
          role="region"
          aria-label="Install mso-pm"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+76px)] z-50 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:w-[360px]"
        >
          <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-accent text-[18px] font-bold text-white">m</span>
          <div className="min-w-0 grow">
            <p className="truncate text-base font-semibold">Install mso-pm</p>
            {/* Only rendered in the browser (the banner is hidden on the server), so `location` is safe. */}
            <p className="truncate text-sm text-ink-3">{location.host}</p>
          </div>
          <Button
            variant="primary"
            className="h-9 px-3.5"
            onClick={async () => {
              if (state === "ios") return setIos(true);
              if (!(await promptInstall())) closeBanner();
            }}
          >
            Install
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close" className="-mr-1 shrink-0" onClick={closeBanner}>
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      ) : null}
      <IosInstallDialog open={ios} onOpenChange={setIos} />
    </>
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
