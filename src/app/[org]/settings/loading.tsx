import { Skeleton } from "@/components/ui/states";

/** Shown while a settings section loads. The settings nav stays in place beside it. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-2.5 w-3/5" />
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className={i % 2 ? "h-[34px] w-1/2" : "h-[34px] w-full"} />)}
      </div>
    </div>
  );
}
