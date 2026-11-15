import { cn } from "./cn";

const HAS_GT_LOGO = process.env.NEXT_PUBLIC_HAS_GT_LOGO === "1";
const SIZES = { md: "h-10", lg: "h-14" } as const;

/**
 * Lockup: the Georgia Tech "GT" logo (public/brand/gt-logo.png) followed by "FixIt" in navy;
 * the logo stands in for the letters "GT". Sized by height so the PNG stays sharp on retina
 * screens (use a source at least 3x the displayed height). Until the file is added, the
 * original faceted mark is shown instead.
 */
export function Logo({ className, compact = false, size = "md" }: { className?: string; compact?: boolean; size?: keyof typeof SIZES }) {
  if (HAS_GT_LOGO) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic size unknown; height-only sizing keeps the aspect ratio */}
        <img src="/brand/gt-logo.png" alt="Georgia Tech" className={cn(SIZES[size], "w-auto shrink-0 object-contain")} decoding="async" />
        {!compact && <span className={cn("font-display font-bold tracking-tight text-gt-navy", size === "lg" ? "text-4xl" : "text-[1.7rem] leading-none")}>FixIt</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className={cn("shrink-0", size === "lg" ? "size-12" : "size-9")} aria-hidden="true">
        <polygon points="16,1 30,9 30,23 16,31 2,23 2,9" fill="#b3a369" />
        <polygon points="16,1 30,9 16,16" fill="#d9cc97" />
        <polygon points="2,9 16,16 2,23" fill="#a08f55" />
        <polygon points="30,9 16,16 30,23" fill="#c6b87e" />
        <path d="M19.500 9.500a4.200 4.200 0 0 0-5.200 5.200L9 20a1.900 1.900 0 0 0 2.700 2.700l5.300-5.300a4.200 4.200 0 0 0 5.200-5.200l-2.600 2.600-2.100-.5-.5-2.100 2.500-2.700Z" fill="#00111f" />
      </svg>
      {!compact && (
        <span className={cn("font-display font-bold tracking-tight", size === "lg" ? "text-3xl" : "text-xl")}>
          GT <span className="text-gold-ink">FixIt</span>
        </span>
      )}
    </span>
  );
}
