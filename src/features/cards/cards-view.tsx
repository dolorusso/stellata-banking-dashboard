"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { CARDS_KEY, CardControls } from "./card-controls";
import { CardTransactions } from "./card-transactions";
import { CardVisual } from "./card-visual";

const HEADER = { title: "Cards", description: "Manage your virtual debit card." };

export function CardsSkeleton() {
  return (
    <>
      <PageHeader {...HEADER} />
      <div className="space-y-6" aria-busy="true" aria-label="Loading cards">
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Skeleton className="aspect-[1.586] w-full max-w-[380px] rounded-2xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </>
  );
}

export function CardsView() {
  const query = useQuery({ queryKey: CARDS_KEY, queryFn: api.cards });
  const card = query.data?.[0];

  if (query.isPending) return <CardsSkeleton />;

  return (
    <>
      <PageHeader {...HEADER} />
      {query.isError ? (
        <ErrorState title="Couldn't load your cards" error={query.error} onRetry={() => query.refetch()} />
      ) : !card ? (
        <EmptyState icon={CreditCard} title="No cards yet" description="Virtual cards you issue will appear here." />
      ) : (
        <div className="space-y-6">
          <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <CardVisual card={card} />
            <CardControls card={card} />
          </div>
          <CardTransactions cardId={card.id} />
        </div>
      )}
    </>
  );
}
