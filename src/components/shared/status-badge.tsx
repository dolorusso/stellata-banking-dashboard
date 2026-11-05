import { CircleCheck, CircleX, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TransactionStatus } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const STATUS = {
  completed: { label: "Completed", icon: CircleCheck, className: "text-positive" },
  pending: { label: "Pending", icon: Clock, className: "text-warning" },
  failed: { label: "Failed", icon: CircleX, className: "text-negative" },
} as const;

/** Status always ships icon + label: never color alone. */
export function StatusBadge({ status, className }: { status: TransactionStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STATUS[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <Icon className={cn("size-3", tone)} aria-hidden="true" />
      {label}
    </Badge>
  );
}
