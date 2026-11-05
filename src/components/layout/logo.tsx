import { cn } from "@/lib/utils";

export const APP_NAME = "Stellata";

/** Four-point "stellate" mark: a nod to Quercus stellata, the post oak. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-sidebar-primary" />
      <path
        d="M16 5c.9 5.6 3.3 8.6 11 11-7.7 2.4-10.1 5.4-11 11-.9-5.6-3.3-8.6-11-11 7.7-2.4 10.1-5.4 11-11Z"
        className="fill-sidebar-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}
