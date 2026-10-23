"use client";

import { useSyncExternalStore } from "react";

// "Install app": Chrome, Edge and Android fire `beforeinstallprompt` once,
// early, so it is captured here at start-up and replayed when someone clicks
// Install. Safari on iPhone/iPad has no prompt; people use Share → Add to Home Screen.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function initInstallPrompt() {
  if (started) return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export type InstallState = "installed" | "prompt" | "ios" | "unavailable";

function read(): InstallState {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed || standalone) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "unavailable";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, read, () => "unavailable");
}

/** Show the browser's install dialog. Returns true if the person installed. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}
