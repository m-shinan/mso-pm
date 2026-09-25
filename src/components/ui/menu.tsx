"use client";

import * as M from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;

export function MenuContent({ children, className, align = "start", label }: { children: ReactNode; className?: string; align?: "start" | "end"; label?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        aria-label={label}
        className={cn("animate-pop z-50 min-w-[200px] rounded-lg border border-line bg-surface p-1.5 shadow-pop outline-none", className)}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ children, className, onSelect, destructive }: { children: ReactNode; className?: string; onSelect?: () => void; destructive?: boolean }) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none select-none data-highlighted:bg-subtle max-lg:h-11 max-lg:text-lg",
        destructive ? "text-danger-ink" : "text-ink",
        className,
      )}
    >
      {children}
    </M.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2 pt-1.5 pb-1 text-2xs font-medium text-ink-4">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line-soft" />;
}
