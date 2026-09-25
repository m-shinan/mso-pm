// Status, priority and severity markers. Colours come from the organization's
// options; shapes carry meaning too, so nothing relies on colour alone.

import type { StatusGlyph } from "@/lib/options";
import { tone } from "@/lib/options";
import type { Option } from "@/lib/types";
import { cn } from "@/lib/utils";

function pie(fraction: number) {
  // Wedge from 12 o'clock clockwise, radius 3.5 around (7,7).
  if (fraction >= 0.999) return "M7 3.5 A3.5 3.5 0 1 1 6.99 3.5 Z";
  const a = fraction * 2 * Math.PI;
  const x = 7 + 3.5 * Math.sin(a);
  const y = 7 - 3.5 * Math.cos(a);
  return `M7 7 L7 3.5 A3.5 3.5 0 ${fraction > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export function StatusIcon({
  status,
  glyph,
  size = 14,
  className,
}: {
  status: Pick<Option, "name" | "color"> | undefined;
  glyph: StatusGlyph;
  size?: number;
  className?: string;
}) {
  const c = status?.color ?? "#8A8A92";
  const filled = glyph.shape === "blocked" || glyph.shape === "done";
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" role="img" aria-label={status?.name ?? "Status"} className={cn("shrink-0", className)}>
      <circle
        cx="7"
        cy="7"
        r="6"
        fill={filled ? c : "none"}
        stroke={c}
        strokeWidth="1.5"
        strokeDasharray={glyph.shape === "empty" && glyph.dashed ? "2 2.2" : undefined}
      />
      {glyph.shape === "pie" && <path d={pie(glyph.fraction)} fill={c} />}
      {glyph.shape === "blocked" && <path d="M4.6 7 H9.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />}
      {glyph.shape === "done" && (
        <path d="M4.4 7.2 L6.2 9 L9.6 5.3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Three bars; the number filled is the priority rank. The top rank uses its colour. */
export function PriorityIcon({ priority, className }: { priority: Pick<Option, "name" | "color" | "rank"> | undefined; className?: string }) {
  const rank = priority?.rank ?? 0;
  const top = rank >= 4;
  const on = top ? priority!.color : "#45454C";
  const fill = (i: number) => (top || rank >= i ? on : "#D6D5D0");
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" role="img" aria-label={`${priority?.name ?? "No"} priority`} className={cn("shrink-0", className)}>
      <rect x="1.5" y="8" width="2.6" height="4.5" rx="0.8" fill={fill(1)} />
      <rect x="5.7" y="5" width="2.6" height="7.5" rx="0.8" fill={fill(2)} />
      <rect x="9.9" y="2" width="2.6" height="10.5" rx="0.8" fill={fill(3)} />
    </svg>
  );
}

/** Text badge for issue severity — the word carries the meaning, colour supports it. */
export function SeverityBadge({ severity, className }: { severity: Pick<Option, "name" | "color"> | undefined; className?: string }) {
  if (!severity) return null;
  return (
    <span className={cn("inline-flex items-center justify-center rounded px-2 py-0.5 text-2xs font-semibold", className)} style={tone(severity.color)}>
      {severity.name}
    </span>
  );
}

/** Coloured dot + name, for project and release statuses. */
export function StatusDot({ option, className }: { option: Pick<Option, "name" | "color"> | undefined; className?: string }) {
  if (!option) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: option.color }} />
      {option.name}
    </span>
  );
}

/** Tinted pill + dot, for the single status in a page header. */
export function StatusPill({ option }: { option: Pick<Option, "name" | "color"> | undefined }) {
  if (!option) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[12.5px] font-medium" style={tone(option.color)}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: option.color }} />
      {option.name}
    </span>
  );
}
