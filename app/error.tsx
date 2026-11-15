"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { WrenchGem } from "@/components/ui/Illustration";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center" role="alert">
        <WrenchGem className="mx-auto size-28" />
        <h1 className="mt-3 font-display text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-ink-muted">
          {error.digest ? "The server hit a problem loading this page." : error.message || "Unexpected error."} Try again, and if it keeps happening, check your connection.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="gold" size="lg" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className={buttonClass({ size: "lg" })}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
