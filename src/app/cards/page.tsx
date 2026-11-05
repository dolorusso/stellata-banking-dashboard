import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Placeholder } from "@/components/shared/placeholder";

export const metadata: Metadata = { title: "Cards" };

export default function CardsPage() {
  return (
    <>
      <PageHeader title="Cards" description="Manage your virtual debit card." />
      <Placeholder />
    </>
  );
}
