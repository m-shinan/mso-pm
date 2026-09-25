import { cn } from "@/lib/utils";

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "done" }) {
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("block h-1 overflow-hidden rounded-sm bg-track", className)}
    >
      <span className={cn("block h-1", tone === "done" ? "bg-success" : "bg-accent")} style={{ width: `${value}%` }} />
    </span>
  );
}
