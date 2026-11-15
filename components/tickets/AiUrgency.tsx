"use client";

import { useId, useState, useTransition } from "react";
import { setTriageUrgency } from "@/app/tech/actions";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import type { Priority, Ticket } from "@/lib/types";
import { aiDisagrees } from "@/lib/urgency";
import { cn } from "@/components/ui/cn";
import { AlertIcon, ChevronRightIcon, SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";

export type AiFields = Pick<Ticket, "id" | "priority" | "ai_urgency" | "ai_reason" | "ai_safety" | "ai_status" | "ai_reviewed" | "triage_urgency" | "triage_by">;

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap";

/**
 * Smart Sort badge: "AI: Medium (reported Urgent)". Tap it for the AI's reason and a one-tap
 * Accept / override. The reporter's urgency is never changed; the choice is saved as triage_urgency.
 */
export function AiUrgency({ t, viewerId, canEdit, affected, defaultOpen = false }: { t: AiFields; viewerId: string; canEdit: boolean; affected?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [chosen, setChosen] = useState<Priority | null>(t.triage_urgency);
  const [pending, start] = useTransition();
  const toast = useToast();
  const panelId = useId();
  const rated = t.ai_reviewed && t.ai_status === "done" && t.ai_urgency;
  const disagrees = aiDisagrees(t);

  function choose(u: Priority) {
    const prev = chosen;
    setChosen(u);
    start(async () => {
      try {
        const res = await setTriageUrgency(t.id, u);
        if (!res.ok) throw new Error(res.error);
        toast(res.message);
      } catch (err) {
        setChosen(prev);
        toast(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.", "error");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(PILL, "min-h-8 bg-white text-ink ring-slate-300 hover:bg-navy-50", !rated && "text-ink-muted")}
        >
          <SparkleIcon className="size-3.5 text-gold-ink" />
          {rated ? (
            <>
              AI: {PRIORITY_META[t.ai_urgency!].label}
              <span className="font-normal text-ink-muted">(reported {PRIORITY_META[t.priority].label})</span>
            </>
          ) : (
            "AI: not rated"
          )}
          <ChevronRightIcon className={cn("size-3.5 transition", open && "rotate-90")} />
        </button>
        {disagrees && <span className={cn(PILL, "bg-gold-50 text-gold-ink ring-gt-gold/60")}>AI disagrees</span>}
        {t.ai_safety && (
          <span className={cn(PILL, "bg-red-50 text-red-800 ring-red-300")}>
            <AlertIcon className="size-3.5" /> Safety
          </span>
        )}
        {chosen && (
          <span className={cn(PILL, "bg-slate-100 text-ink ring-slate-300")}>
            Set: {PRIORITY_META[chosen].label}
            {chosen === t.triage_urgency && t.triage_by && t.triage_by !== viewerId ? "" : " · by you"}
          </span>
        )}
        {affected !== undefined && affected > 1 && <span className="text-xs font-semibold text-ink-muted">{affected} students affected</span>}
      </div>

      {open && (
        <div id={panelId} className="rounded-2xl bg-page p-3 text-sm ring-1 ring-line">
          <p className="text-ink">
            {rated ? t.ai_reason : t.ai_status === "pending" ? "The AI hasn't rated this yet. It's sorted by the reporter's urgency." : "The AI couldn't rate this one, so it keeps the reporter's urgency."}
          </p>
          {canEdit && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-ink-muted">{rated ? "Accept the AI's urgency or pick your own:" : "Set the urgency:"}</p>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Set urgency">
                {PRIORITIES.map((p) => {
                  const isAi = rated && t.ai_urgency === p;
                  const active = chosen === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={pending}
                      aria-pressed={active}
                      onClick={() => choose(p)}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-xs font-semibold ring-1 transition disabled:opacity-60",
                        active ? "bg-gt-gold text-navy-950 ring-gt-gold" : "bg-white text-ink ring-slate-300 hover:bg-navy-50",
                      )}
                    >
                      {isAi ? "Accept AI" : PRIORITY_META[p].label}
                      {isAi && <span className="font-normal">{PRIORITY_META[p].label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Staff-only panel on the request detail page and the admin drawer. */
export function AiTriagePanel(props: { t: AiFields; viewerId: string; canEdit: boolean; affected?: number }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-sm md:p-6" aria-label="AI urgency">
      <h2 className="mb-3 font-display text-lg font-bold">Urgency (AI suggestion)</h2>
      <AiUrgency {...props} defaultOpen />
    </section>
  );
}
