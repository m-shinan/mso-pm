"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * Centered dialog on desktop, bottom sheet on phones.
 * Radix handles focus trap, Esc, aria-modal and scroll lock.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  className,
  role,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  role?: "alertdialog";
}) {
  return (
    <D.Portal>
      <D.Overlay className="animate-fade fixed inset-0 z-40 bg-[rgb(24_24_28/0.34)]" />
      <D.Content
        role={role}
        className={cn(
          "fixed z-50 flex flex-col bg-surface outline-none",
          // phone: bottom sheet
          "animate-sheet inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl pb-[max(env(safe-area-inset-bottom),12px)]",
          // desktop: centered dialog
          "lg:animate-pop lg:inset-auto lg:top-[12vh] lg:left-1/2 lg:w-[520px] lg:-translate-x-1/2 lg:rounded-xl lg:border lg:border-line lg:pb-0 lg:shadow-dialog",
          className,
        )}
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong lg:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 lg:pt-[18px]">
          <div className="flex flex-col gap-1">
            <D.Title className="text-xl font-semibold lg:text-[16px]">{title}</D.Title>
            {description ? <D.Description className="text-sm leading-normal text-ink-3">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="-mr-2 inline-flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-subtle lg:size-[30px]">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-3.5 max-lg:[&>*]:flex-1">{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}

/** Right-hand drawer on desktop, full-height sheet on phones. Used for detail panels. */
export function DrawerContent({
  label,
  header,
  children,
  className,
}: {
  label: string;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="animate-fade fixed inset-0 z-40 bg-[rgb(24_24_28/0.24)] lg:bg-transparent" />
      <D.Content
        aria-describedby={undefined}
        tabIndex={-1}
        // Focus the panel itself, not its first button, so no stray focus ring on open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        className={cn(
          "animate-drawer fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface outline-none lg:w-[480px] lg:border-l lg:border-line lg:shadow-[-8px_0_24px_rgb(20_20_24/0.06)]",
          className,
        )}
      >
        <D.Title className="sr-only">{label}</D.Title>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line-soft pr-3 pl-6">
          {header}
          <span className="grow" />
          <D.Close aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-md text-ink-3 hover:bg-subtle lg:size-[30px]">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 grow overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
