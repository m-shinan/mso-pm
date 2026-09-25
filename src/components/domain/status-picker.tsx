"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useOrg } from "@/components/shell/org-provider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useIsDesktop } from "@/lib/use-media";
import type { OptionKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusIcon } from "./markers";

/**
 * Local, optimistic status for one row. Phase 4 swaps the body of `set` for a
 * TanStack Query mutation that updates only this task in the cache and rolls
 * back on error — the call sites stay the same.
 */
export function useOptimisticStatus(initial: string, label: string) {
  const [statusId, setStatusId] = useState(initial);
  const { config } = useOrg();
  const toast = useToast();
  function set(next: string) {
    if (next === statusId) return;
    const prev = statusId;
    setStatusId(next);
    toast({
      message: <>{label} moved to {config.get(next)?.name}</>,
      action: { label: "Undo", onClick: () => setStatusId(prev) },
    });
  }
  return [statusId, set] as const;
}

/** Status icon that opens a picker: a menu on desktop, a bottom sheet with big targets on phones. */
export function StatusPicker({
  kind = "task_status",
  value,
  onChange,
  label,
  subtitle,
  iconSize = 14,
  className,
}: {
  kind?: OptionKind;
  value: string;
  onChange: (id: string) => void;
  label: string;
  subtitle?: ReactNode;
  iconSize?: number;
  className?: string;
}) {
  const { config, can } = useOrg();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const status = config.get(value);
  const options = config.ofKind(kind);
  const icon = <StatusIcon status={status} glyph={config.glyph(value)} size={iconSize} />;
  const editable = can(kind === "issue_status" ? "issues.update" : "tasks.update");

  if (!editable) return <span className={cn("inline-flex", className)}>{icon}</span>;

  const trigger = cn("inline-flex shrink-0 items-center justify-center rounded-md hover:bg-subtle", className);
  const ariaLabel = `Change status of ${label}, currently ${status?.name}`;

  if (desktop) {
    return (
      <Menu>
        <MenuTrigger aria-label={ariaLabel} className={trigger} onClick={(e) => e.stopPropagation()}>
          {icon}
        </MenuTrigger>
        <MenuContent label="Status">
          {options.map((o) => (
            <MenuItem key={o.id} onSelect={() => onChange(o.id)}>
              <StatusIcon status={o} glyph={config.glyph(o.id)} />
              <span className="grow">{o.name}</span>
              {o.id === value ? <Check aria-hidden className="size-3.5 text-accent" /> : null}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" aria-label={ariaLabel} className={trigger} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}>
        {icon}
      </button>
      <DialogContent title={label} description={subtitle}>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-sm font-semibold text-ink-2">Status</legend>
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => {
              const on = o.id === value;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { onChange(o.id); setOpen(false); }}
                  className={cn(
                    "flex h-12 items-center gap-2.5 rounded-[10px] px-3 text-left text-[14.5px]",
                    on ? "border-[1.5px] border-accent bg-accent-soft font-semibold" : "border border-line",
                  )}
                >
                  <StatusIcon status={o} glyph={config.glyph(o.id)} size={18} />
                  <span className="grow">{o.name}</span>
                  {on ? <Check aria-hidden className="size-4 text-accent" strokeWidth={2.4} /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
