"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/states";

/**
 * Route-level error boundary: keeps the shell (navigation) usable if a page crashes.
 * The raw error stays in the console, and users see a generic message, not internals.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState title="This page couldn't load" onRetry={reset} className="py-24" />;
}
