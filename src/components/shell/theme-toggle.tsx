"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * One click between light and dark. The icon follows <html data-theme> through
 * CSS, so it is right on first paint. "System" stays available in the account menu.
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Switch between light and dark mode"
      onClick={() => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-line bg-surface text-ink-3 hover:bg-sunken hover:text-ink max-lg:size-11 max-lg:border-0 max-lg:bg-transparent",
        className,
      )}
    >
      <Moon aria-hidden className="size-4 max-lg:size-5 [[data-theme=dark]_&]:hidden" strokeWidth={1.7} />
      <Sun aria-hidden className="hidden size-4 max-lg:size-5 [[data-theme=dark]_&]:block" strokeWidth={1.7} />
    </button>
  );
}
