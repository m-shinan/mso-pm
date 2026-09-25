import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

type Person = Pick<Member, "name" | "initials" | "tint">;

const SIZES = { xs: "size-5 text-[8.5px]", sm: "size-[22px] text-[9.5px]", md: "size-7 text-[11px]", lg: "size-[30px] text-[11.5px]" };

export function Avatar({ person, size = "sm", className }: { person: Person | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  if (!person) {
    return (
      <span
        title="Unassigned"
        aria-label="Unassigned"
        className={cn("inline-block shrink-0 rounded-full border-[1.5px] border-dashed border-ink-6", SIZES[size], className)}
      />
    );
  }
  return (
    <span
      title={person.name}
      aria-label={person.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", SIZES[size], className)}
      style={{ background: person.tint.bg, color: person.tint.fg }}
    >
      {person.initials}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex">
      {shown.map((p) => (
        <Avatar key={p.initials} person={p} className="-mr-1 ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-subtle text-[9px] font-semibold text-ink-2 ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </span>
  );
}
