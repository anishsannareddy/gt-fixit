"use client";

import type { ReactNode } from "react";
import { addNote, setPriority, setStatus, updateTicket } from "@/app/requests/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Label, SegmentedControl, Select, Textarea } from "@/components/ui/Form";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import type { Priority, Role, Status } from "@/lib/types";

export type ActionTicket = { id: number; status: Status; priority: Priority; assignee_id: string | null; reporter_id: string };

/**
 * The "what can I do here?" panel for one request, by role. The server re-checks every
 * permission (app/requests/actions.ts), so this only decides what to show.
 */
export function TicketActions({
  ticket,
  viewer,
  technicians = [],
}: {
  ticket: ActionTicket;
  viewer: { id: string; role: Role };
  technicians?: { id: string; name: string }[];
}) {
  const mine = ticket.assignee_id === viewer.id;
  const open = ticket.status !== "resolved";

  if (viewer.role === "reporter") {
    if (ticket.reporter_id !== viewer.id || open) return null;
    return (
      <Panel title="Still not fixed?">
        <ActionForm action={updateTicket} resetOnSuccess className="space-y-3">
          {(pending) => (
            <>
              <Hidden id={ticket.id} action="reopen" />
              <Label htmlFor="reopen-note" optional>
                What&apos;s still wrong?
              </Label>
              <Textarea id="reopen-note" name="note" rows={2} placeholder="e.g. The AC stopped working again tonight." />
              <Button type="submit" disabled={pending}>
                {pending ? "Reopening…" : "Reopen request"}
              </Button>
            </>
          )}
        </ActionForm>
      </Panel>
    );
  }

  if (viewer.role === "technician") {
    if (ticket.status === "submitted") {
      return (
        <Panel title="Pick this up">
          <ActionForm action={updateTicket}>
            {(pending) => (
              <>
                <Hidden id={ticket.id} action="claim" />
                <Button variant="gold" size="lg" type="submit" full disabled={pending}>
                  {pending ? "Claiming…" : "Claim this request"}
                </Button>
              </>
            )}
          </ActionForm>
        </Panel>
      );
    }
    if (!mine) {
      return open ? <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-muted ring-1 ring-line">Another technician is working on this request.</p> : null;
    }
    if (!open) return null;
    return (
      <Panel title="Your next step">
        <div className="space-y-5">
          {ticket.status === "assigned" && (
            <ActionForm action={updateTicket}>
              {(pending) => (
                <>
                  <Hidden id={ticket.id} action="start" />
                  <Button variant="gold" size="lg" type="submit" full disabled={pending}>
                    {pending ? "Starting…" : "Start work"}
                  </Button>
                </>
              )}
            </ActionForm>
          )}
          <ResolveForm id={ticket.id} primary={ticket.status === "in_progress"} />
          <NoteForm id={ticket.id} />
        </div>
      </Panel>
    );
  }

  // Admin
  return (
    <Panel title="Manage this request">
      <div className="space-y-6">
        {open && (
          <ActionForm action={updateTicket} className="space-y-2">
            {(pending) => (
              <>
                <Hidden id={ticket.id} action="assign" />
                <Label htmlFor={`assign-${ticket.id}`}>Technician</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select id={`assign-${ticket.id}`} name="assignee_id" defaultValue={ticket.assignee_id ?? ""} required className="sm:flex-1">
                    <option value="" disabled>
                      Choose a technician…
                    </option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : ticket.assignee_id ? "Reassign" : "Assign"}
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        )}

        <ActionForm action={setStatus} className="space-y-2">
          {(pending) => (
            <>
              <input type="hidden" name="id" value={ticket.id} />
              <Label htmlFor={`status-${ticket.id}`}>Status</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select id={`status-${ticket.id}`} name="status" defaultValue={ticket.status} className="sm:flex-1">
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Set status"}
                </Button>
              </div>
            </>
          )}
        </ActionForm>

        <ActionForm action={setPriority} className="space-y-2">
          {(pending) => (
            <>
              <input type="hidden" name="id" value={ticket.id} />
              <SegmentedControl
                key={ticket.priority}
                name="priority"
                label="Priority"
                defaultValue={ticket.priority}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, danger: p === "urgent" }))}
              />
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save priority"}
              </Button>
            </>
          )}
        </ActionForm>

        {(ticket.status === "assigned" || ticket.status === "in_progress") && <ResolveForm id={ticket.id} primary />}
        {ticket.status === "resolved" && (
          <ActionForm action={updateTicket}>
            {(pending) => (
              <>
                <Hidden id={ticket.id} action="reopen" />
                <Button type="submit" disabled={pending}>
                  {pending ? "Reopening…" : "Reopen request"}
                </Button>
              </>
            )}
          </ActionForm>
        )}
        <NoteForm id={ticket.id} />
      </div>
    </Panel>
  );
}

function ResolveForm({ id, primary }: { id: number; primary: boolean }) {
  return (
    <ActionForm action={updateTicket} className="space-y-2">
      {(pending) => (
        <>
          <Hidden id={id} action="resolve" />
          <Label htmlFor={`resolve-${id}`} optional>
            Resolution note
          </Label>
          <Textarea id={`resolve-${id}`} name="note" rows={2} placeholder="What did you fix? e.g. Replaced faucet cartridge." />
          <Button variant={primary ? "gold" : "glass"} size={primary ? "lg" : "md"} type="submit" full={primary} disabled={pending}>
            {pending ? "Resolving…" : "Mark resolved"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

function NoteForm({ id }: { id: number }) {
  return (
    <ActionForm action={addNote} resetOnSuccess className="space-y-2 border-t border-line pt-5">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Label htmlFor={`note-${id}`}>Add a note</Label>
          <Textarea id={`note-${id}`} name="note" rows={2} required placeholder="Visible to staff and the reporter on the timeline." />
          <Button type="submit" size="sm" variant="ghost" disabled={pending} className="ring-1 ring-line">
            {pending ? "Adding…" : "Add note"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Hidden({ id, action }: { id: number; action: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}
