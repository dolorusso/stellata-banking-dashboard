import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      className="py-24"
      action={
        <Button asChild>
          <Link href="/">Back to overview</Link>
        </Button>
      }
    />
  );
}
