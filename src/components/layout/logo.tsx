import { cn } from "@/lib/utils";

export const APP_NAME = "Stellata";

/**
 * Oak tree silhouette on a 32×32 grid: a broad, lobed crown (wider than tall,
 * like a post oak, Quercus stellata) over a flared trunk. Built from simple
 * shapes so it still reads at 16px (favicon). Mirrored in src/app/icon.svg.
 */
export function OakShape(props: React.SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      <circle cx="16" cy="11.2" r="6" />
      <circle cx="9.6" cy="13.8" r="4.6" />
      <circle cx="22.4" cy="13.8" r="4.6" />
      <circle cx="12.2" cy="8.8" r="3.9" />
      <circle cx="19.8" cy="8.8" r="3.9" />
      <circle cx="16" cy="15.4" r="4.6" />
      <path d="M14.7 17.5h2.6v5.6c0 .9.5 1.6 1.5 2l1.6.7v.9h-9.8v-.9l1.6-.7c1-.4 1.5-1.1 1.5-2Z" />
    </g>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-sidebar-primary" />
      <OakShape className="fill-sidebar-primary-foreground" />
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
