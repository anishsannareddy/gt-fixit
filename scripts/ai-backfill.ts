/**
 * Runs the real AI triage over requests already in the database.
 *   npm run ai:backfill                  open requests: AI urgency, reason, category
 *   npm run ai:backfill -- --regroup     also merge duplicate reports (oldest first; only reports that are still their own group)
 *   npm run ai:backfill -- --all         include resolved requests
 *   npm run ai:backfill -- --limit 20    only the first 20
 *   npm run ai:backfill -- --dry-run     call the AI and print results, change nothing
 *
 * Needs OPENAI_API_KEY in .env.local. Seeded requests already have pre-baked AI fields, so this is
 * optional: it replaces them with real model output.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { aiEnabled, DEFAULT_MODEL, generateStructured } from "../lib/ai/provider";
import { runTriage, type RunResult } from "../lib/ai/run";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const regroup = flag("--regroup");
const dryRun = flag("--dry-run");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  if (!aiEnabled()) throw new Error("Set OPENAI_API_KEY in .env.local (and don't set AI_PROVIDER=off).");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let q = sb.from("requests").select("id, group_id, title").order("created_at", { ascending: true });
  if (!flag("--all")) q = q.neq("status", "resolved");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).slice(0, limit) as { id: number; group_id: number; title: string }[];
  console.log(`Running ${process.env.OPENAI_MODEL || DEFAULT_MODEL} on ${rows.length} requests${regroup ? " (with duplicate grouping)" : ""}${dryRun ? " (dry run)" : ""}…`);

  const results: (RunResult & { id: number; title: string })[] = [];
  const one = async (r: (typeof rows)[number]) => {
    let group = false;
    if (regroup) {
      // Only reports that are still alone can join another group, so curated groups stay intact.
      const { count } = await sb.from("requests").select("id", { count: "exact", head: true }).eq("group_id", r.group_id);
      group = (count ?? 0) <= 1;
    }
    const res = await runTriage(sb, r.id, generateStructured, { group, chronological: true, dryRun });
    if (res) results.push({ ...res, id: r.id, title: r.title });
    process.stdout.write(res?.status === "done" ? "." : "x");
  };

  if (regroup) {
    for (const r of rows) await one(r); // oldest first, so later duplicates can join earlier groups
  } else {
    for (let i = 0; i < rows.length; i += 3) await Promise.all(rows.slice(i, i + 3).map(one));
  }

  const done = results.filter((r) => r.status === "done");
  const fell = results.filter((r) => r.status === "fallback");
  const disagree = done.filter((r) => r.urgency !== r.reporter);
  console.log(`\n✓ ${done.length} rated, ${fell.length} fell back, ${disagree.length} where AI and reporter disagree, ${done.filter((r) => r.merged).length} merged into an existing issue`);
  for (const r of disagree.slice(0, 15)) console.log(`  #${r.id} ${r.title}: reported ${r.reporter} → AI ${r.urgency}${r.merged ? ` (joins group ${r.merged})` : ""}`);
  if (fell.length) console.log(`  First fallback reason: ${fell[0].error}`);
}

main().catch((err) => {
  console.error("\n✗ Backfill failed:", err.message ?? err);
  process.exit(1);
});
