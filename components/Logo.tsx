export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-gt-gold text-gt-navy">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3a4 4 0 0 1-5-5L10 5l3-3 1.7 1.7a4 4 0 0 0 0 2.6Z" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        GT <span className="text-gt-gold">FixIt</span>
      </span>
    </span>
  );
}
