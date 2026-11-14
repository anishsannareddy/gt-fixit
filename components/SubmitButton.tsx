"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** A submit button that disables itself and shows a pending label while its form's action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = "btn-primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
