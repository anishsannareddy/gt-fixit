import { Skeleton } from "@/components/ui/Feedback";

/** Shown while a page's data loads. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pt-6 md:px-6 md:pt-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-72" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
