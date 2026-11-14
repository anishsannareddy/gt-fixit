"use client";

import { useEffect, useRef, useState } from "react";
import { CameraIcon, XIcon } from "./Icons";

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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Add a photo"
        onChange={(e) => select(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo preview" className="h-44 w-auto max-w-full rounded-xl object-cover shadow-sm" />
          <button
            type="button"
            onClick={() => {
              select(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/75"
            aria-label="Remove photo"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-slate-600 transition hover:border-gt-gold hover:bg-gt-gold-50"
        >
          <CameraIcon className="size-7 text-gt-navy" />
          <span className="font-semibold text-slate-800">Take or upload a photo</span>
          <span className="text-xs">Optional · JPG or PNG</span>
        </button>
      )}
    </div>
  );
}
