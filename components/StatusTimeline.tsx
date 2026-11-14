import type { TicketEvent } from "@/lib/types";
import { STATUS_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const VERB: Record<string, string> = {
  submitted: "submitted the request",
  assigned: "assigned it",
  in_progress: "started work",
  resolved: "marked it resolved",
};

export function StatusTimeline({ events }: { events: TicketEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
      {events.map((e) => {
        const reopened = e.from_status === "resolved" && e.to_status === "submitted";
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute top-1 -left-[31px] size-4 rounded-full ring-4 ring-white ${STATUS_META[e.to_status].dot}`}
              aria-hidden="true"
            />
            <p className="text-sm text-slate-900">
              <span className="font-semibold">{e.actor?.name ?? "Someone"}</span>{" "}
              {reopened ? "reopened the request" : e.to_status === "assigned" && e.actor?.role === "technician" ? "claimed it" : VERB[e.to_status]}
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(e.created_at)}</p>
            {e.note && <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
