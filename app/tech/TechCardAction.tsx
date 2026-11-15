"use client";

import { useState } from "react";
import { updateTicket } from "@/app/requests/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { HandIcon, CheckIcon, PlayIcon } from "@/components/ui/Icons";
import { Label, Textarea } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import type { Status } from "@/lib/types";

/**
 * One big, thumb-sized button for the next step on a request:
 * Claim (unassigned) → Start (assigned to me) → Resolve (in progress; opens a sheet for a note).
 */
export function TechCardAction({ id, title, status, mine }: { id: number; title: string; status: Status; mine: boolean }) {
  const [resolving, setResolving] = useState(false);

  if (status === "submitted") return <OneTap id={id} action="claim" label="Claim" pending="Claiming…" icon={<HandIcon className="size-5" />} />;
  if (!mine || status === "resolved") return null;
  if (status === "assigned") return <OneTap id={id} action="start" label="Start work" pending="Starting…" icon={<PlayIcon className="size-5" />} />;

  return (
    <>
      <Button variant="gold" size="lg" full onClick={() => setResolving(true)}>
        <CheckIcon className="size-5" /> Resolve
      </Button>
      <Sheet open={resolving} onClose={() => setResolving(false)} eyebrow={`Request #${id}`} title={`Resolve: ${title}`}>
        <ActionForm action={updateTicket} onDone={() => setResolving(false)} className="space-y-3">
          {(pending) => (
            <>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="action" value="resolve" />
              <Label htmlFor={`resolve-note-${id}`} optional>
                What did you fix?
              </Label>
              <Textarea id={`resolve-note-${id}`} name="note" rows={3} autoFocus placeholder="e.g. Replaced the faucet cartridge." />
              <p className="text-xs text-ink-muted">The reporter sees this note on their request.</p>
              <Button variant="gold" size="lg" full type="submit" disabled={pending}>
                {pending ? "Resolving…" : "Mark resolved"}
              </Button>
            </>
          )}
        </ActionForm>
      </Sheet>
    </>
  );
}

function OneTap({ id, action, label, pending: pendingLabel, icon }: { id: number; action: string; label: string; pending: string; icon: React.ReactNode }) {
  return (
    <ActionForm action={updateTicket}>
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value={action} />
          <Button variant="gold" size="lg" full type="submit" disabled={pending}>
            {icon} {pending ? pendingLabel : label}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
