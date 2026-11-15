"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Request drawer for the Command Center. Open state lives in the URL (?ticket=<id>), so the
 * drawer survives refreshes and can be linked to. Closing removes the param.
 */
export function AdminDrawer({ ticketId, title, children }: { ticketId: number; title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function close() {
    const next = new URLSearchParams(params);
    next.delete("ticket");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  return (
    <Sheet open variant="drawer" onClose={close} eyebrow={`Request #${ticketId}`} title={title}>
      {children}
    </Sheet>
  );
}
