import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Placeholder } from "@/components/shared/placeholder";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Your cash position across every account." />
      <Placeholder />
    </>
  );
}
