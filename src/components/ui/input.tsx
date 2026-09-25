import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-2.5 text-base text-ink placeholder:text-ink-5 " +
  "focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-ring " +
  "aria-invalid:border-danger-border aria-invalid:focus:ring-danger-soft max-lg:text-lg";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-[34px] max-lg:h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
});

/** Native select: accessible, and uses the OS picker on phones. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <span className="relative block">
      <select ref={ref} className={cn(control, "h-[34px] appearance-none pr-8 max-lg:h-11", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-4" />
    </span>
  );
});

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink max-lg:text-sm">
        {label}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? noteId : undefined })}
      {error ? (
        <span id={noteId} className="text-xs text-danger-ink">{error}</span>
      ) : hint ? (
        <span id={noteId} className="text-xs text-ink-4">{hint}</span>
      ) : null}
    </div>
  );
}
