"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import imageCompression from "browser-image-compression";
import type { ActiveIssue } from "@/lib/issues";
import type { Building } from "@/lib/types";
import { IssueCard } from "@/components/issues/IssueCard";
import { CATEGORIES, PHOTO_BUCKET, PRIORITIES, PRIORITY_META, type Category } from "@/lib/constants";
import { browserSupabase } from "@/lib/supabase/browser";
import { PhotoUploader } from "@/components/PhotoUploader";
import { FieldError, Input, Label, SegmentedControl, Select, Textarea } from "@/components/ui/Form";
import { VISIBILITY_HELP } from "@/components/tickets/VisibilityControl";
import { DESCRIPTION_MAX, ROOM_MAX, SPOTS, descriptionError, roomError, type Visibility } from "@/lib/validation";
import {
  ApplianceIcon, BoltIcon, BugIcon, BulbIcon, ChairIcon, DotsIcon, DropletIcon, ElevatorIcon, LockIcon, SparkleIcon, ThermometerIcon,
} from "@/components/ui/Icons";
import { createPhotoUploadUrl, createRequest, findSimilarIssues, type ReportState } from "./actions";

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
export function ReportForm({
  building,
  onBusy,
  onCreated,
  hasIssues = false,
  onJoined,
}: {
  building: Building;
  onBusy: (label: string | null) => void;
  /** Called with the new request id once it's saved. */
  onCreated: (id: number) => void;
  /** The building has active issues, so look for similar ones while the student types. */
  hasIssues?: boolean;
  /** The student tapped "Me too" on a suggestion instead of submitting. */
  onJoined?: (issue: ActiveIssue) => void;
}) {
  const [state, formAction, saving] = useActionState<ReportState, FormData>(createRequest, undefined);
  const similar = useSimilarIssues(building.id, hasIssues);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [where, setWhere] = useState<"room" | "spot">("room");
  const [room, setRoom] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  // Client-side errors appear once a field is left (or on submit); the server checks again.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const local = {
    room: where === "room" && touched.room ? roomError(room) : null,
    description: touched.description ? descriptionError(description) : null,
  };
  const errors = { ...(state?.fieldErrors ?? {}), ...Object.fromEntries(Object.entries(local).filter(([, v]) => v)) } as Record<string, string>;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    setTouched({ room: true, description: true });
    if ((where === "room" && roomError(room)) || descriptionError(description)) return;
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

  // When the save finishes: re-enable the submit button, and show the success screen if it worked.
  useEffect(() => {
    if (saving || !state) return;
    onBusy(null);
    if (state.created) onCreated(state.created.id);
  }, [saving, state, onBusy, onCreated]);

  return (
    <form id={REPORT_FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-5">
      <input type="hidden" name="building_id" value={building.id} />

      <div>
        <SegmentedControl
          name="location_kind"
          label="Where is it?"
          value={where}
          onChange={setWhere}
          options={[
            { value: "room", label: "In a room" },
            { value: "spot", label: "Not in a room" },
          ]}
        />
        {where === "room" ? (
          <div className="mt-2">
            <Label htmlFor="room">Room number</Label>
            <Input
              id="room"
              name="room"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. 405, 1116A or G12"
              maxLength={ROOM_MAX}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, room: true }))}
              aria-invalid={Boolean(errors.room)}
              aria-describedby="room-error"
            />
            <div id="room-error">
              <FieldError>{errors.room}</FieldError>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <Label htmlFor="spot">Spot</Label>
            <Select id="spot" name="spot" defaultValue={SPOTS[0]}>
              {SPOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <FieldError>{errors.spot}</FieldError>
          </div>
        )}
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
        <Input id="title" name="title" placeholder="e.g. AC not cooling" maxLength={120} aria-invalid={Boolean(errors.title)} onChange={(e) => similar.setTitle(e.target.value)} />
        <FieldError>{errors.title}</FieldError>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="description">Details</Label>
          <span className={description.length > DESCRIPTION_MAX ? "text-xs font-semibold text-red-700" : "text-xs text-ink-muted"} aria-live="polite" data-testid="description-count">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What's happening? When did it start?"
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            similar.setDescription(e.target.value);
          }}
          onBlur={() => setTouched((t) => ({ ...t, description: true }))}
          aria-invalid={Boolean(errors.description)}
        />
        <FieldError>{errors.description}</FieldError>
      </div>

      {similar.issues.length > 0 && (
        <section aria-live="polite" aria-label="Similar active issues" className="rounded-2xl bg-gold-50 p-3 ring-1 ring-gt-gold/50">
          <p className="mb-2.5 px-1 text-sm font-semibold text-ink">Is it one of these? Tap Me too instead of sending a new report.</p>
          <div className="space-y-2">
            {similar.issues.map((i) => (
              <IssueCard key={i.id} issue={i} compact onVoted={onJoined} />
            ))}
          </div>
        </section>
      )}

      <div>
        <SegmentedControl
          name="visibility"
          label="Who can see it?"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "public", label: "Public" },
            { value: "private", label: "Private" },
          ]}
        />
        <p className="mt-1.5 text-xs text-ink-muted">{VISIBILITY_HELP[visibility]}</p>
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

/**
 * Looks for active issues in this building that match what the student is typing.
 * Waits 1.2s after they stop typing, needs 12+ characters, and skips repeat queries.
 */
function useSimilarIssues(buildingId: number, enabled: boolean) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issues, setIssues] = useState<ActiveIssue[]>([]);
  const last = useRef("");

  useEffect(() => {
    const text = `${title.trim()} ${description.trim()}`.trim();
    if (!enabled || text.length < 12 || text === last.current) return;
    const timer = setTimeout(async () => {
      last.current = text;
      try {
        setIssues(await findSimilarIssues(buildingId, title, description));
      } catch {
        // Suggestions are optional; never get in the way of reporting.
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [buildingId, enabled, title, description]);

  return { issues, setTitle, setDescription };
}
