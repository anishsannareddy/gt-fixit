import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { BlockTower } from "@/components/ui/Illustration";

export default function NotFound() {
  return (
    <div className="bg-campus flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <BlockTower className="mx-auto size-32" />
        <p className="mt-2 font-mono text-sm font-semibold text-gold-ink">404</p>
        <h1 className="mt-1 font-display text-3xl font-bold">We couldn&apos;t find that</h1>
        <p className="mt-2 text-ink-muted">The page or request doesn&apos;t exist, or it isn&apos;t yours to see.</p>
        <Link href="/" className={buttonClass({ variant: "gold", size: "lg", className: "mt-6" })}>
          Go to my home page
        </Link>
      </div>
    </div>
  );
}
