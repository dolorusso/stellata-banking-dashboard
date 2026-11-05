import type { Metadata } from "next";
import { Suspense } from "react";
import { CardsSkeleton, CardsView } from "@/features/cards/cards-view";

export const metadata: Metadata = { title: "Cards" };

export default function CardsPage() {
  // Card state is client-held (localStorage event log), so the view fetches after hydration.
  return (
    <Suspense fallback={<CardsSkeleton />}>
      <CardsView />
    </Suspense>
  );
}
