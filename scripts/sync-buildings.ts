/** npm run buildings:sync — update building names, areas and aliases in place (ids never change). */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { syncBuildings } from "./buildings";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

syncBuildings(createClient(url, key, { auth: { persistSession: false } }))
  .then((rows) => console.log(`✓ ${rows.length} GT buildings up to date (ids unchanged)`))
  .catch((err) => {
    console.error("✗", err.message ?? err);
    process.exit(1);
  });
