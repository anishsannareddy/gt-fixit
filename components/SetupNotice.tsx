import { AlertIcon } from "./Icons";

/** Shown on the landing page when .env.local is missing or the DB hasn't been seeded. */
export function SetupNotice({ problem }: { problem: "env" | "db"; detail?: string }) {
  return (
    <div className="card mx-auto max-w-xl border-amber-300 bg-amber-50 p-6">
      <div className="flex items-center gap-2 font-semibold text-amber-900">
        <AlertIcon className="size-5" /> Setup needed
      </div>
      {problem === "env" ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-amber-950">
          <li>Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>.</li>
          <li>Paste in your Supabase URL, anon key and service-role key.</li>
          <li>Restart <code className="font-mono">npm run dev</code>.</li>
        </ol>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-amber-950">
          <li>Open Supabase → SQL Editor, paste <code className="font-mono">supabase/schema.sql</code>, click Run.</li>
          <li>In your terminal run <code className="font-mono">npm run seed</code>.</li>
          <li>Refresh this page.</li>
        </ol>
      )}
    </div>
  );
}
