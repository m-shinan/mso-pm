"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog, DialogContent } from "./dialog";
import { Input } from "./input";

/**
 * Confirmation for destructive actions only. `confirmText` makes the user type
 * something (e.g. the project key) before the button enables.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  actionLabel,
  onConfirm,
  confirmText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  actionLabel: string;
  onConfirm: () => void;
  confirmText?: string;
}) {
  const [typed, setTyped] = useState("");
  const ready = !confirmText || typed.trim().toUpperCase() === confirmText.toUpperCase();
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTyped(""); }}>
      <DialogContent
        role="alertdialog"
        title={title}
        className="lg:w-[440px]"
        footer={
          <>
            <Button onClick={() => onOpenChange(false)} className="max-lg:h-11">Cancel</Button>
            <Button variant="danger" disabled={!ready} onClick={() => { onConfirm(); onOpenChange(false); setTyped(""); }} className="max-lg:h-11">
              {actionLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm leading-normal text-ink-2">
          {children}
          {confirmText ? (
            <label className="flex flex-col gap-1.5 text-[12.5px]">
              <span>Type <span className="font-mono text-ink">{confirmText}</span> to confirm</span>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
