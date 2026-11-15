import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Frosted panel that floats over the 3D campus or gradient background. */
export function GlassPanel({ className, strong, ...rest }: ComponentProps<"div"> & { strong?: boolean }) {
  return <div className={cn(strong ? "glass-strong" : "glass", "rounded-3xl shadow-panel", className)} {...rest} />;
}

/** Rounded content card. */
export function Card({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("rounded-3xl border border-line bg-white p-5", className)} {...rest} />;
}

/** Standard page width + padding (and room for the mobile tab bar). */
export function PageContainer({ className, narrow, ...rest }: ComponentProps<"div"> & { narrow?: boolean }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16", narrow ? "max-w-3xl" : "max-w-6xl", className)}
      {...rest}
    />
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-ink uppercase">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-none font-bold tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
