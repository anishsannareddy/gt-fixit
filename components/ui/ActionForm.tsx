"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/app/requests/actions";
import { useToast } from "./Toast";

/**
 * A form that calls a server action, shows a toast with the result, and exposes `pending`
 * to its children so buttons can show "Saving…". The page refreshes itself because the
 * server action revalidates it.
 */
export function ActionForm({
  action,
  children,
  className,
  onDone,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode | ((pending: boolean) => ReactNode);
  className?: string;
  /** Called after a successful action (e.g. close a sheet). */
  onDone?: () => void;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form, (e.nativeEvent as SubmitEvent).submitter);
    start(async () => {
      try {
        const result = await action(data);
        if (result.ok) {
          toast(result.message);
          if (resetOnSuccess) form.reset();
          onDone?.();
        } else toast(result.error, "error");
      } catch {
        toast("Something went wrong. Check your connection and try again.", "error");
      }
    });
  }

  return (
    <form onSubmit={submit} className={className} aria-busy={pending}>
      {typeof children === "function" ? children(pending) : children}
    </form>
  );
}
