import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

const CHIP =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gt-navy";
const ON = "border-gt-gold bg-gt-gold text-navy-950";
const OFF = "border-field/60 bg-white text-ink-muted hover:border-gt-navy hover:text-ink";

/** Pill that is a link (filters/tabs driven by the URL) or a button (client state). */
export function Chip({
  active = false,
  href,
  onClick,
  count,
  children,
  className,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  const cls = cn(CHIP, active ? ON : OFF, className);
  const inner = (
    <>
      {children}
      {count !== undefined && <span className={cn("tabular-nums", active ? "opacity-70" : "text-ink-muted")}>{count}</span>}
    </>
  );
  if (href)
    return (
      <Link href={href} scroll={false} aria-current={active ? "true" : undefined} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {inner}
    </button>
  );
}

/** Horizontally scrollable row of chips (edge-to-edge on phones). */
export function ChipRow({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 [scrollbar-width:none]", className)}>
      <div className="flex gap-2" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
