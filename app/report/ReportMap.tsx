"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { BuildingSearch } from "@/components/campus/BuildingSearch";
import { CampusCanvas } from "@/components/campus/CampusCanvas";
import { AreaBadge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/Icons";
import { GemCheck } from "@/components/ui/Illustration";
import { Sheet } from "@/components/ui/Sheet";
import { useIsDesktop } from "@/components/ui/useMediaQuery";
import { AREA_META } from "@/lib/campus/areas";
import type { ActiveIssue } from "@/lib/issues";
import type { Building } from "@/lib/types";
import { IssueCard } from "@/components/issues/IssueCard";
import { issueKey } from "@/components/issues/key";
import { REPORT_FORM_ID, ReportForm } from "./ReportForm";

/** Student home: the 3D campus as a building picker. Pick a building (tap it or search) to open the report form. */
export function ReportMap({ buildings, issues }: { buildings: Building[]; issues: ActiveIssue[] }) {
  const [selected, setSelected] = useState<Building | null>(null);
  // A building with active issues shows them first; "Report a new issue" switches to the form.
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const desktop = useIsDesktop();
  const byOsmId = useMemo(() => new Map(buildings.filter((b) => b.osm_id).map((b) => [b.osm_id!, b])), [buildings]);

  function choose(b: Building | null) {
    setBusy(null);
    setCreatedId(null);
    setReporting(false);
    setSelected(b);
  }
  const here = selected ? issues.filter((i) => i.building.id === selected.id) : [];
  const showIssues = here.length > 0 && !reporting && !createdId;
  const onCreated = useCallback((id: number) => setCreatedId(id), []);

  return (
    <div className="relative flex-1">
      <div className="fixed inset-0">
        <CampusCanvas
          mode="select"
          view="brand"
          selected={selected?.osm_id ?? null}
          onSelect={(info) => {
            const b = byOsmId.get(info.id);
            if (b) choose(b);
          }}
          panel={selected ? (desktop ? "right" : "bottom") : "none"}
          fallback={
            <div className="grid h-full place-items-center p-6 text-center">
              <p className="max-w-xs text-sm text-ink-muted">The 3D map isn&apos;t available on this device. Use the search box above to pick a building.</p>
            </div>
          }
        />
      </div>

      <div className="pointer-events-none relative z-10 mx-auto max-w-xl px-4 pt-4">
        <BuildingSearch buildings={buildings} onPick={choose} className="pointer-events-auto" />
        {!selected && (
          <p className="mx-auto mt-3 w-fit rounded-full bg-white/90 px-4 py-1.5 text-center text-sm font-medium text-ink shadow-sm ring-1 ring-line">
            Tap a building, or search, to report a problem there
          </p>
        )}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => choose(null)}
        eyebrow={createdId ? "Request sent" : showIssues ? "Active issues here" : "Report an issue"}
        title={selected?.name ?? ""}
        footer={
          createdId ? undefined : showIssues ? (
            <Button variant="gold" size="lg" full onClick={() => setReporting(true)}>
              <PlusIcon className="size-5" /> Report a new issue
            </Button>
          ) : (
            <button type="submit" form={REPORT_FORM_ID} disabled={busy !== null} className={buttonClass({ variant: "gold", size: "lg", full: true })}>
              {busy ?? "Submit request"}
            </button>
          )
        }
      >
        {selected && createdId ? (
          <Success id={createdId} building={selected} onAnother={() => choose(null)} />
        ) : selected && showIssues ? (
          <div>
            <p className="mb-4 rounded-2xl bg-gold-50 px-4 py-3 text-sm font-medium text-ink ring-1 ring-gt-gold/50">
              Already reported? Tap <strong>Me too</strong>. Otherwise, report a new issue.
            </p>
            <div className="space-y-2.5">
              {here.map((i) => (
                <IssueCard key={issueKey(i)} issue={i} compact />
              ))}
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <AreaBadge area={selected.area} />
              {selected.number && <span>Building #{selected.number}</span>}
              <span>Goes to the {AREA_META[selected.area].label} maintenance team</span>
            </div>
            {/* key = start a fresh form when a different building is picked */}
            <ReportForm key={selected.id} building={selected} onBusy={setBusy} onCreated={onCreated} />
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

function Success({ id, building, onAnother }: { id: number; building: Building; onAnother: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center" role="status">
      <motion.div initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}>
        <GemCheck className="size-32" />
      </motion.div>
      <h3 className="mt-2 font-display text-2xl font-bold">Thanks, it&apos;s reported!</h3>
      <p className="mt-1 text-ink-muted">
        Request <span className="font-mono font-semibold text-ink">#{id}</span> went to the {AREA_META[building.area].label} maintenance team. We&apos;ll keep its status up to date.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Link href={`/requests/${id}`} className={buttonClass({ variant: "gold", size: "lg", full: true })}>
          View request
        </Link>
        <Button size="lg" full onClick={onAnother}>
          Report another issue
        </Button>
        <Link href="/my-requests" className="mt-1 text-sm font-semibold text-ink underline decoration-gt-gold decoration-2 underline-offset-4">
          See all my requests
        </Link>
      </div>
    </div>
  );
}
