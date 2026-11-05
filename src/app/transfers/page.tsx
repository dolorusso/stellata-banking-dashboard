import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Placeholder } from "@/components/shared/placeholder";

export const metadata: Metadata = { title: "Transfers" };

export default function TransfersPage() {
  return (
    <>
      <PageHeader title="Transfers" description="Send ACH or wire payments, or move money between accounts." />
      <Placeholder />
    </>
  );
}
