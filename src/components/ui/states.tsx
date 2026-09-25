import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-5 py-9 text-center", className)}>
      <Icon aria-hidden className="size-6 text-ink-5" strokeWidth={1.6} />
      <p className="text-md font-semibold">{title}</p>
      {children ? <p className="max-w-[300px] text-sm leading-normal text-ink-3">{children}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-2.5 rounded-lg border border-danger-line bg-[#FEF7F6] px-3 py-2.5">
      <AlertCircle aria-hidden className="size-4 shrink-0 text-danger-ink" />
      <span className="grow text-sm">{message}</span>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded bg-track", className)} />;
}

/** A labelled loading block: says what is loading, then shows placeholder rows. */
export function LoadingRows({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 p-4">
      <span className="text-xs text-ink-4">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className={cn("h-2.5", i % 2 ? "w-3/5" : "w-4/5")} />
        </div>
      ))}
    </div>
  );
}
