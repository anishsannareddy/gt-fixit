"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setVisibility } from "@/app/requests/actions";
import { SegmentedControl } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

type V = "public" | "private";

/** Reporter's own request: switch between Public and Private. */
export function VisibilityControl({ id, value }: { id: number; value: V }) {
  const [v, setV] = useState<V>(value);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function change(next: V) {
    if (next === v || pending) return;
    setV(next);
    start(async () => {
      const res = await setVisibility(id, next).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
      if (!res.ok) {
        setV(v);
        toast(res.error, "error");
        return;
      }
      toast(res.message);
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-line" aria-busy={pending}>
      <SegmentedControl
        name="visibility"
        label="Who can see this request?"
        value={v}
        onChange={change}
        options={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]}
      />
      <p className="mt-1.5 text-xs text-ink-muted">{VISIBILITY_HELP[v]}</p>
    </section>
  );
}

export const VISIBILITY_HELP: Record<V, string> = {
  public: "Other students can see it in Active issues and tap Me too. Your name is never shown.",
  private: "Only you and maintenance staff can see it. It won't be listed in Active issues.",
};
