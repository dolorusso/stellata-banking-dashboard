"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states";
import { accountsQuery, payeesQuery } from "@/lib/queries";
import { RecentTransfers } from "./recent-transfers";
import { TransferFlow } from "./transfer-flow";
import { TransfersSkeleton } from "./transfers-skeleton";

export function TransfersView() {
  const accounts = useQuery(accountsQuery);
  const payees = useQuery(payeesQuery);

  return (
    <>
      <PageHeader title="Transfers" description="Send ACH or wire payments, or move money between your accounts." />
      {accounts.isPending || payees.isPending ? (
        <TransfersSkeleton />
      ) : accounts.isError || payees.isError ? (
        <ErrorState
          title="Couldn't load your accounts"
          error={accounts.error ?? payees.error}
          onRetry={() => {
            void accounts.refetch();
            void payees.refetch();
          }}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <TransferFlow accounts={accounts.data} payees={payees.data} />
          </div>
          <div className="lg:col-span-2">
            <RecentTransfers accounts={accounts.data} />
          </div>
        </div>
      )}
    </>
  );
}
