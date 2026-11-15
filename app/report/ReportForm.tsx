"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import imageCompression from "browser-image-compression";
import type { Building } from "@/lib/types";
import { CATEGORIES, PHOTO_BUCKET, PRIORITIES, PRIORITY_META, type Category } from "@/lib/constants";
import { browserSupabase } from "@/lib/supabase/browser";
import { PhotoUploader } from "@/components/PhotoUploader";
import { FieldError, Input, Label, SegmentedControl, Textarea } from "@/components/ui/Form";
import {
  ApplianceIcon, BoltIcon, BugIcon, BulbIcon, ChairIcon, DotsIcon, DropletIcon, ElevatorIcon, LockIcon, SparkleIcon, ThermometerIcon,
} from "@/components/ui/Icons";
import { createPhotoUploadUrl, createRequest, type ReportState } from "./actions";

export const REPORT_FORM_ID = "report-form";

const CATEGORY_ICON: Record<Category, typeof BoltIcon> = {
  Plumbing: DropletIcon,
  Electrical: BoltIcon,
  "HVAC / Temperature": ThermometerIcon,
  Elevator: ElevatorIcon,
  Lighting: BulbIcon,
  "Doors & Locks": LockIcon,
  Furniture: ChairIcon,
  "Custodial / Cleaning": SparkleIcon,
  "Pest Control": BugIcon,
  Appliances: ApplianceIcon,
  Other: DotsIcon,
};
const CATEGORY_SHORT: Partial<Record<Category, string>> = {
  "HVAC / Temperature": "Heating & AC",
  "Custodial / Cleaning": "Cleaning",
  "Doors & Locks": "Doors & locks",
  "Pest Control": "Pests",
};

/**
 * The report form shown in the sheet after a building is picked on the map.
 * The submit button lives in the sheet footer and targets this form by id.
 * `onBusy` tells the parent when a photo upload or save is running, so it can label that button.
 */
export function ReportForm({ building, onBusy }: { building: Building; onBusy: (label: string | null) => void }) {
  const [state, formAction, saving] = useActionState<ReportState, FormData>(createRequest, undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const errors = state?.fieldErrors ?? {};

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);

    if (photo) {
      onBusy("Uploading photo…");
      try {
        // 1. Shrink big phone photos (often 3–8MB) to ~1MB in the browser
        const compressed = await imageCompression(photo, { maxSizeMB: 1, maxWidthOrHeight: 1920, fileType: "image/jpeg", useWebWorker: true });
        // 2. Ask our server for a one-time upload URL
        const signed = await createPhotoUploadUrl();
        if ("error" in signed) throw new Error(signed.error);
        // 3. Upload directly from the browser to Supabase Storage
        const { error } = await browserSupabase().storage.from(PHOTO_BUCKET).uploadToSignedUrl(signed.path, signed.token, compressed, { contentType: "image/jpeg" });
        if (error) throw error;
        formData.set("photo_path", signed.path);
      } catch (err) {
        console.error(err);
        setUploadError("Photo upload failed. Try again, or remove the photo to submit without it.");
        onBusy(null);
        return;
      }
    }

    onBusy("Submitting…");
    startTransition(() => formAction(formData));
  }

  // The action redirects on success; if it comes back with errors instead, re-enable the submit button.
  useEffect(() => {
    if (!saving && state) onBusy(null);
  }, [saving, state, onBusy]);

  return (
    <form id={REPORT_FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-5">
      <input type="hidden" name="building_id" value={building.id} />

      <div>
        <Label htmlFor="location_detail" optional>
          Room, floor or area
        </Label>
        <Input id="location_detail" name="location_detail" placeholder="e.g. Room 214, 3rd floor bathroom" maxLength={120} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink">What kind of issue?</legend>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            return (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="category" value={c} className="peer sr-only" />
                <span className="flex h-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-white px-1 py-2.5 text-center text-xs font-semibold text-ink-muted transition peer-checked:border-gt-navy peer-checked:ring-2 peer-checked:ring-gt-gold peer-checked:bg-gold-50 peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gt-navy hover:border-slate-300">
                  <Icon className="size-6" />
                  {CATEGORY_SHORT[c] ?? c}
                </span>
              </label>
            );
          })}
        </div>
        <FieldError>{errors.category}</FieldError>
      </fieldset>

      <div>
        <SegmentedControl
          name="priority"
          label="How urgent is it?"
          defaultValue="medium"
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, danger: p === "urgent" }))}
        />
        <p className="mt-1.5 text-xs text-ink-muted">Urgent is for safety risks or flooding.</p>
        <FieldError>{errors.priority}</FieldError>
      </div>

      <div>
        <Label htmlFor="title">Short summary</Label>
        <Input id="title" name="title" placeholder="e.g. AC not cooling" maxLength={120} aria-invalid={Boolean(errors.title)} />
        <FieldError>{errors.title}</FieldError>
      </div>

      <div>
        <Label htmlFor="description" optional>
          Details
        </Label>
        <Textarea id="description" name="description" rows={3} placeholder="What's happening? When did it start?" maxLength={2000} />
        <FieldError>{errors.description}</FieldError>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink">Photo</p>
        <PhotoUploader onChange={setPhoto} />
        <FieldError>{uploadError}</FieldError>
      </div>

      <FieldError>{state?.error}</FieldError>
      {Object.keys(errors).length > 0 && <FieldError>Please fix the highlighted fields above.</FieldError>}
    </form>
  );
}
