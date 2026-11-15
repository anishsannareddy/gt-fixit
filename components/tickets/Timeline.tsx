import type { TicketEvent } from "@/lib/types";
import { STATUS_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/components/ui/cn";

function describe(e: TicketEvent): string {
  if (e.from_status === e.to_status) return e.note?.startsWith("Priority changed") ? "changed the priority" : "added a note";
  if (e.from_status === null) return "submitted the request";
  if (e.from_status === "resolved") return "reopened the request";
  if (e.to_status === "assigned") return e.actor?.role === "technician" ? "claimed it" : "assigned it";
  if (e.to_status === "in_progress") return "started work";
  if (e.to_status === "resolved") return "marked it resolved";
  return `set the status to ${STATUS_META[e.to_status].label}`;
}

/** Activity history, oldest first. Status changes get a coloured dot; notes get a gray one. */
export function Timeline({ events }: { events: TicketEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-ink-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-line pl-6">
      {events.map((e) => {
        const noteOnly = e.from_status === e.to_status;
        return (
          <li key={e.id} className="relative">
            <span
              className={cn("absolute top-1 -left-[31px] size-4 rounded-full ring-4 ring-white", noteOnly ? "bg-slate-300" : STATUS_META[e.to_status].dot)}
              aria-hidden="true"
            />
            <p className="text-sm">
              <span className="font-semibold">{e.actor?.name ?? "Someone"}</span> <span className="text-ink-muted">{describe(e)}</span>
            </p>
            <p className="text-xs text-ink-muted">{formatDateTime(e.created_at)}</p>
            {e.note && <p className="mt-1.5 rounded-xl bg-page px-3 py-2 text-sm">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
