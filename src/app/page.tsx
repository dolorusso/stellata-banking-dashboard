import type { Metadata } from "next";
import { Suspense } from "react";
import { OverviewSkeleton } from "@/features/overview/overview-skeleton";
import { OverviewView } from "@/features/overview/overview-view";

// Same segment as the root layout, so its title template doesn't apply: set it in full.
export const metadata: Metadata = { title: { absolute: "Overview · Stellata" } };

export default function OverviewPage() {
  // Data is client-held (event log in localStorage), so the view fetches after
  // hydration. Suspense lets Cache Components prerender the shell around it.
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewView />
    </Suspense>
  );
}
