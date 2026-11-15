"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Input, Label, SegmentedControl, Textarea } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

/** The parts of the preview that need client state: sheet, drawer, toast, chips. */
export function Interactive() {
  const [sheet, setSheet] = useState<"sheet" | "drawer" | null>(null);
  const [chip, setChip] = useState("All");
  const toast = useToast();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setSheet("sheet")}>Open sheet</Button>
        <Button onClick={() => setSheet("drawer")}>Open drawer</Button>
        <Button onClick={() => toast("Request #1042 submitted")}>Success toast</Button>
        <Button onClick={() => toast("Photo upload failed", "error")}>Error toast</Button>
      </div>

      <ChipRow label="Example filters">
        {["All", "Plumbing", "Electrical", "HVAC", "Lighting"].map((c, i) => (
          <Chip key={c} active={chip === c} onClick={() => setChip(c)} count={[24, 7, 3, 9, 5][i]}>
            {c}
          </Chip>
        ))}
      </ChipRow>

      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        variant={sheet ?? "sheet"}
        eyebrow="Glenn Hall"
        title={sheet === "drawer" ? "Drawer (admin details)" : "Sheet (report form)"}
        footer={
          <Button variant="gold" size="lg" full onClick={() => setSheet(null)}>
            Primary action
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            On a phone the sheet slides up from the bottom and can be dragged down by its handle. On a laptop it is a side panel. The drawer is
            full-screen on phones and dims the page behind it. Esc closes both.
          </p>
          <div>
            <Label htmlFor="demo-room" optional>
              Room or area
            </Label>
            <Input id="demo-room" placeholder="e.g. Room 214" />
          </div>
          <SegmentedControl
            name="demo-urgency"
            label="How urgent?"
            defaultValue="medium"
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent", danger: true },
            ]}
          />
          <div>
            <Label htmlFor="demo-details">Details</Label>
            <Textarea id="demo-details" rows={4} placeholder="What's happening?" />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
