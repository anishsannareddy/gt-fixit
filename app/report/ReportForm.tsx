"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import imageCompression from "browser-image-compression";
import type { Building } from "@/lib/types";
import { CATEGORIES, PHOTO_BUCKET, PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { browserSupabase } from "@/lib/supabase/browser";
import { BuildingPicker } from "@/components/BuildingPicker";
import { PhotoUploader } from "@/components/PhotoUploader";
import { createPhotoUploadUrl, createRequest, type ReportState } from "./actions";

export function ReportForm({ buildings }: { buildings: Building[] }) {
  const [state, formAction, saving] = useActionState<ReportState, FormData>(createRequest, undefined);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const errors = state?.fieldErrors ?? {};
  const busy = uploading || saving;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const formData = new FormData(e.currentTarget);

    if (photo) {
      setUploading(true);
      try {
        // 1. Shrink big phone photos (often 3–8MB) to ~1MB in the browser
        const compressed = await imageCompression(photo, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          fileType: "image/jpeg",
          useWebWorker: true,
        });
        // 2. Ask our server for a one-time upload URL
        const signed = await createPhotoUploadUrl();
        if ("error" in signed) throw new Error(signed.error);
        // 3. Upload directly from the browser to Supabase Storage
        const { error } = await browserSupabase()
          .storage.from(PHOTO_BUCKET)
          .uploadToSignedUrl(signed.path, signed.token, compressed, { contentType: "image/jpeg" });
        if (error) throw error;
        formData.set("photo_path", signed.path);
      } catch (err) {
        console.error(err);
        setUploadError("Photo upload failed. Try again, or remove the photo to submit without it.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
      <Section step={1} title="Where is the problem?">
        <BuildingPicker buildings={buildings} name="building_id" error={errors.building_id} />
        <FieldError msg={errors.building_id} />
        <div className="mt-3">
          <label htmlFor="location_detail" className="label">
            Room, floor or area <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input id="location_detail" name="location_detail" className="field" placeholder="e.g. Room 214, 3rd floor bathroom" maxLength={120} />
        </div>
      </Section>

      <Section step={2} title="What kind of issue?">
        <fieldset>
          <legend className="sr-only">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" name="category" value={c} className="peer sr-only" required />
                <span className="inline-block rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition peer-checked:border-gt-navy peer-checked:bg-gt-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gt-gold hover:border-gt-navy">
                  {c}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <FieldError msg={errors.category} />

        <fieldset className="mt-5">
          <legend className="label">How urgent is it?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <label key={p} className="cursor-pointer">
                <input type="radio" name="priority" value={p} defaultChecked={p === "medium"} className="peer sr-only" />
                <span className="block h-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition peer-checked:border-gt-navy peer-checked:ring-2 peer-checked:ring-gt-navy/20 peer-focus-visible:ring-2 peer-focus-visible:ring-gt-gold">
                  <span className={`block text-sm font-semibold ${p === "urgent" ? "text-red-700" : "text-slate-900"}`}>{PRIORITY_META[p].label}</span>
                  <span className="block text-xs text-slate-500">{PRIORITY_META[p].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <FieldError msg={errors.priority} />
      </Section>

      <Section step={3} title="Describe it">
        <label htmlFor="title" className="label">Short summary</label>
        <input id="title" name="title" className={`field ${errors.title ? "border-red-400" : ""}`} placeholder="e.g. AC not cooling" maxLength={120} required />
        <FieldError msg={errors.title} />
        <label htmlFor="description" className="label mt-3">
          Details <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea id="description" name="description" rows={4} className="field resize-y" placeholder="What's happening? When did it start?" maxLength={2000} />
        <FieldError msg={errors.description} />
      </Section>

      <Section step={4} title="Add a photo">
        <PhotoUploader onChange={setPhoto} />
        <FieldError msg={uploadError ?? undefined} />
      </Section>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-medium text-red-700">Please fix the highlighted fields above.</p>
      )}

      <div className="sticky bottom-20 z-10 md:static">
        <button type="submit" disabled={busy} className="btn-gold w-full py-3.5 text-base shadow-lg md:w-auto md:px-8 md:shadow-none">
          {uploading ? "Uploading photo…" : saving ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 md:p-6">
      <h2 className="mb-3 flex items-center gap-2.5 font-bold text-gt-navy">
        <span className="grid size-6 place-items-center rounded-full bg-gt-gold text-xs text-gt-navy">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-sm text-red-700">{msg}</p>;
}
