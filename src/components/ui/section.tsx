import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Count } from "./badge";

/** White bordered card with a 44px header row. */
export function Section({
  title,
  count,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ?? (typeof title === "string" ? title.toLowerCase().replace(/\W+/g, "-") : undefined);
  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-lg border border-line bg-surface max-lg:rounded-[10px]", className)}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 pr-3 pl-4">
        <h2 id={headingId} className="flex items-center gap-2 text-md font-semibold whitespace-nowrap max-lg:text-lg">
          {title}
          {count !== undefined ? <Count>{count}</Count> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Grey table header row for list sections. */
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("hidden h-8 items-center gap-4 border-t border-line-soft bg-sunken px-4 text-xs font-medium text-ink-4 lg:grid", className)}>
      {children}
    </div>
  );
}
