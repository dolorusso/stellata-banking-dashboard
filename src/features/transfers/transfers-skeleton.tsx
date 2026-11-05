import { Skeleton } from "@/components/ui/skeleton";

export function TransfersSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-5" aria-busy="true" aria-label="Loading transfers">
      <Skeleton className="h-[34rem] rounded-xl lg:col-span-3" />
      <Skeleton className="h-80 rounded-xl lg:col-span-2" />
    </div>
  );
}
