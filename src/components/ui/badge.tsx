import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Neutral filled tag, e.g. a project type. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded bg-subtle px-[7px] py-px text-xs whitespace-nowrap text-ink-2", className)}>
      {children}
    </span>
  );
}

/** Outlined small label, e.g. a task label or project key. */
export function Label({ children, mono, className }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-line px-[5px] text-2xs leading-[18px] whitespace-nowrap text-ink-2",
        mono && "font-mono text-ink-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small count pill next to headings and nav items. */
export function Count({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 text-xs leading-[18px] font-medium tabular",
        tone === "danger" ? "bg-danger-soft text-danger-ink" : "bg-subtle text-ink-3",
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("rounded border border-line bg-sunken px-[5px] font-mono text-[11px] text-ink-4", className)}>
      {children}
    </kbd>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-ink-4", className)}>{children}</span>;
}
