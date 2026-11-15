import { AlertIcon } from "@/components/ui/Icons";

/** Shown on the landing page when .env.local is missing or the database hasn't been seeded. */
export function SetupNotice({ problem }: { problem: "env" | "db" }) {
  const code = "rounded bg-white px-1.5 py-0.5 font-mono text-[0.85em] text-gold-ink";
  return (
    <div className="glass-strong max-w-md rounded-3xl border-amber-300 bg-amber-50/95 p-5">
      <div className="flex items-center gap-2 font-display text-lg font-bold text-amber-800">
        <AlertIcon className="size-5" /> Setup needed
      </div>
      {problem === "env" ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
          <li>Copy <code className={code}>.env.example</code> to <code className={code}>.env.local</code>.</li>
          <li>Paste in your Supabase URL, anon key and service-role key.</li>
          <li>Restart <code className={code}>npm run dev</code>.</li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
          <li>In Supabase → SQL Editor, paste <code className={code}>supabase/schema.sql</code> and click Run.</li>
          <li>In your terminal, run <code className={code}>npm run seed</code>.</li>
          <li>Refresh this page.</li>
        </ol>
      )}
    </div>
  );
}
