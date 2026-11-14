"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClass } from "./Button";

/** Submit button that disables itself and shows a pending label while its form's server action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...style
}: {
  children: ReactNode;
  pendingLabel?: string;
} & Parameters<typeof buttonClass>[0]) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(style)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
