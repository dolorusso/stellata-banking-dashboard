import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Placeholder } from "@/components/shared/placeholder";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" description="Search, filter and export activity across accounts." />
      <Placeholder />
    </>
  );
}
