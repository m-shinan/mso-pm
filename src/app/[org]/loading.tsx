import { Skeleton } from "@/components/ui/states";

/** Shown while a page's server data loads. The shell stays in place around it. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading page" className="flex flex-col gap-5 px-4 py-5 lg:px-8 lg:py-7">
      <div className="hidden h-[52px] lg:block" />
      <Skeleton className="h-6 w-48" />
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[72px] rounded-lg max-lg:[&:nth-child(n+4)]:hidden" />)}
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className={i % 2 ? "h-2.5 w-2/5" : "h-2.5 w-3/5"} />
          </div>
        ))}
      </div>
    </div>
  );
}
