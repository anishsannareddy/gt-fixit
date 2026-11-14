import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// 16px text stops iOS Safari zooming in when an input is focused.
export const FIELD =
  "w-full rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-base text-white outline-none transition " +
  "placeholder:text-white/40 focus:border-gt-gold focus:bg-white/10 focus:ring-2 focus:ring-gt-gold/30 " +
  "aria-[invalid=true]:border-red-400/70";

export function Label({ className, optional, children, ...rest }: ComponentProps<"label"> & { optional?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-semibold text-white/90", className)} {...rest}>
      {children}
      {optional && <span className="font-normal text-white/45"> (optional)</span>}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(FIELD, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD, "resize-y", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(FIELD, "appearance-auto pr-3", className)} {...rest} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-red-300">
      {children}
    </p>
  );
}

/**
 * Radio group styled as a segmented control. Works in plain forms (uncontrolled, via `name`)
 * or controlled (pass `value` + `onChange`).
 */
export function SegmentedControl<T extends string>({
  name,
  options,
  defaultValue,
  value,
  onChange,
  label,
  className,
}: {
  name: string;
  options: { value: T; label: string; hint?: string; danger?: boolean }[];
  defaultValue?: T;
  value?: T;
  onChange?: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-sm font-semibold text-white/90">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-white/10 bg-black/25 p-1">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              className="peer sr-only"
              {...(value !== undefined
                ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
                : { defaultChecked: defaultValue === o.value })}
            />
            <span
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-xl px-2 text-center text-sm font-semibold text-white/65 transition",
                "peer-checked:bg-gt-gold peer-checked:text-navy-950 peer-checked:shadow-glow",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-light",
                o.danger && "peer-checked:bg-red-400 peer-checked:shadow-none",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
