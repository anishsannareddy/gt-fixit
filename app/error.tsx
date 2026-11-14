"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <h1 className="text-xl font-bold text-gt-navy">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">{error.message || "Unexpected error."}</p>
      <div className="mt-5 flex justify-center gap-2">
        <button onClick={reset} className="btn-primary">Try again</button>
        <Link href="/" className="btn-outline">Home</Link>
      </div>
    </div>
  );
}
