import { cn } from "./cn";

/** Original wordmark: a faceted gold tile with a wrench, plus "GT FixIt" in the display font. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden="true">
        <polygon points="16,1 30,9 30,23 16,31 2,23 2,9" fill="#b3a369" />
        <polygon points="16,1 30,9 16,16" fill="#d9cc97" />
        <polygon points="2,9 16,16 2,23" fill="#a08f55" />
        <polygon points="30,9 16,16 30,23" fill="#c6b87e" />
        <path d="M19.500 9.500a4.200 4.200 0 0 0-5.200 5.200L9 20a1.900 1.900 0 0 0 2.700 2.700l5.300-5.300a4.200 4.200 0 0 0 5.200-5.200l-2.600 2.600-2.100-.5-.5-2.100 2.500-2.700Z" fill="#00111f" />
      </svg>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-tight">
          GT <span className="text-gold-ink">FixIt</span>
        </span>
      )}
    </span>
  );
}
