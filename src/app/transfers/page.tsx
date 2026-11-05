import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TransfersSkeleton } from "@/features/transfers/transfers-skeleton";
import { TransfersView } from "@/features/transfers/transfers-view";

export const metadata: Metadata = { title: "Transfers" };

function TransfersFallback() {
  return (
    <>
      <PageHeader title="Transfers" description="Send ACH or wire payments, or move money between your accounts." />
      <TransfersSkeleton />
    </>
  );
}

export default function TransfersPage() {
  // Client-held data (event log in localStorage): fetch after hydration behind Suspense.
  return (
    <Suspense fallback={<TransfersFallback />}>
      <TransfersView />
    </Suspense>
  );
}
