"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteRequest } from "@/app/requests/actions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** "Delete request" (danger) with a confirm dialog. The server re-checks who may delete. */
export function DeleteRequest({ id, title }: { id: number; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function confirm() {
    start(async () => {
      const res = await deleteRequest(id).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
      if (!res.ok) {
        toast(res.error, "error");
        setOpen(false);
        return;
      }
      toast(res.message);
      setOpen(false);
      router.push(("redirectTo" in res && res.redirectTo) || "/");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-red-200 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-1 font-display text-lg font-bold">Delete this request</h2>
      <p className="mb-3 text-sm text-ink-muted">Removes it for everyone, along with its photo and history.</p>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete request
      </Button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby={`delete-title-${id}`}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line bg-white p-6 text-ink shadow-panel backdrop:bg-navy-950/40"
      >
        {open && (
          <>
            <h2 id={`delete-title-${id}`} className="font-display text-xl font-bold">
              Delete request #{id}?
            </h2>
            <p className="mt-2 text-sm break-words text-ink-muted">
              “{title}” will be permanently removed, along with its photos and history. This cannot be undone.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="glass" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirm} disabled={pending}>
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
