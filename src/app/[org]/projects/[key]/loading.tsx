import { Skeleton } from "@/components/ui/states";

/** Shown while a project tab loads. The project header and tabs stay in place above it. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3 px-4 py-5 lg:px-8 lg:py-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className={i % 2 ? "h-2.5 w-2/5" : "h-2.5 w-3/5"} />
        </div>
      ))}
    </div>
  );
}
