"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, XIcon } from "@/components/ui/Icons";

/**
 * Lets the user take/choose a photo and shows a preview.
 * The actual upload happens when the form is submitted (see ReportForm).
 */
export function PhotoUploader({ onChange }: { onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  // Free the preview's memory when the component goes away
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function select(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewRef.current);
    onChange(file);
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" aria-label="Add a photo" onChange={(e) => select(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo preview" className="h-40 w-auto max-w-full rounded-2xl object-cover ring-1 ring-white/15" />
          <button
            type="button"
            onClick={() => {
              select(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/65 text-white hover:bg-black/80"
            aria-label="Remove photo"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/25 bg-white/[0.04] px-4 py-4 text-left transition hover:border-gt-gold hover:bg-white/[0.08]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gt-gold/15 text-gold-light">
            <CameraIcon className="size-6" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Take or upload a photo</span>
            <span className="block text-xs text-white/50">Optional, but it helps the technician come prepared</span>
          </span>
        </button>
      )}
    </div>
  );
}
