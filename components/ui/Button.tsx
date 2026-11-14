import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "gold" | "glass" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition duration-200 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-light " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  // The one primary action on a screen
  gold: "bg-gt-gold text-navy-950 shadow-glow hover:-translate-y-0.5 hover:bg-gold-light",
  glass: "border border-white/15 bg-white/10 text-white backdrop-blur hover:-translate-y-0.5 hover:bg-white/16",
  ghost: "text-white/75 hover:bg-white/10 hover:text-white",
  danger: "border border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/25",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 rounded-xl px-3 text-sm",
  md: "min-h-11 rounded-2xl px-4 text-sm",
  lg: "min-h-13 rounded-2xl px-6 text-base",
  xl: "min-h-16 rounded-3xl px-8 text-lg",
};

export function buttonClass(opts: { variant?: Variant; size?: Size; full?: boolean; className?: string } = {}) {
  const { variant = "glass", size = "md", full, className } = opts;
  return cn(BASE, VARIANTS[variant], SIZES[size], full && "w-full", className);
}

type Common = { variant?: Variant; size?: Size; full?: boolean; className?: string; children: ReactNode };

/** Renders a <Link> when `href` is given, otherwise a <button>. */
export function Button(
  props: Common & ({ href: string } | ({ href?: undefined } & Omit<ComponentProps<"button">, "className" | "children">)),
) {
  const { variant, size, full, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, full, className });
  if ("href" in rest && rest.href !== undefined) {
    return (
      <Link href={rest.href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...(rest as ComponentProps<"button">)}>
      {children}
    </button>
  );
}
