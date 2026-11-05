import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionsView } from "@/features/transactions/transactions-view";

export const metadata: Metadata = { title: "Transactions" };

function TransactionsFallback() {
  return (
    <>
      <PageHeader title="Transactions" description="Search, filter and export activity across your accounts." />
      <Skeleton className="h-[32rem] rounded-xl" />
    </>
  );
}

export default function TransactionsPage() {
  // useSearchParams (?account=) and client-held data both need a Suspense boundary.
  return (
    <Suspense fallback={<TransactionsFallback />}>
      <TransactionsView />
    </Suspense>
  );
}
