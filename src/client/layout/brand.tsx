import { cn } from "@/lib/utils";

/** Logo mark: two overlapping "thought" circles — knowledge connecting. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="9" cy="12" r="5" />
        <circle cx="15" cy="12" r="5" />
      </svg>
    </span>
  );
}
