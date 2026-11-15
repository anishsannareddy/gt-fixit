@AGENTS.md

# GT FixIt — notes for Claude Code

Campus maintenance app for the Georgia Tech Campus Solutions Challenge. See README.md for setup.

## Stack & conventions
- Next.js 16 App Router, TypeScript, Tailwind v4 (theme tokens in `app/globals.css`: `gt-navy` #003057, `gt-gold` #B3A369; shared `@utility` classes `card`, `field`, `label`, `btn-primary`, `btn-gold`, `btn-outline`).
- **`cacheComponents` is intentionally OFF** (next.config.ts). Pages read the demo cookie and are dynamic.
- Next 16: `proxy.ts` (not middleware), `params`/`searchParams` are Promises, use global `PageProps<'/route'>` types.
- Mobile-first: test at 375px width. Bottom tab bar on mobile (`components/NavLinks.tsx`), inputs use 16px text.

## Data & auth
- All DB access is server-side via `db()` from `lib/supabase/server.ts` (service-role key). Never import it in a Client Component.
- Auth: Supabase Auth (email + password, `@supabase/ssr`) for identity; role comes from our `users` table. `requireUser(roles)` from `lib/auth.ts` at the top of every page and server action. Never trust roles from Auth metadata or the client.
- Status changes go through `updateTicket` in `app/requests/actions.ts`, which writes a `request_events` row. Keep that invariant.
- Schema: `supabase/schema.sql`. If you change it, update `lib/types.ts` and `scripts/seed.ts`, and tell the user to re-run the SQL in Supabase.

## Checks before finishing a change
`npm run lint && npm run typecheck && npm run build`

## 3D campus and maintenance areas
- `data/campus.json`: OpenStreetMap footprints + roads (from `scripts/fetch-osm.ts`). `data/zones.json`: building → maintenance area, read off the GT Facilities zone map (`scripts/assign-zones.py`). Both are static and committed; nothing calls OSM at runtime.
- Hand corrections go in `data/zone-overrides.json` (OSM id → `area` / `name` / `number` / `aliases` / `note`), never in the generated files. After changing it, run `npm run buildings:sync` (or `npm run seed`). Buildings are upserted by `osm_id` and never deleted, so ids are stable.
- `lib/campus/areas.ts` (area list, labels, colours; cheap to import) vs `lib/campus/zones.ts` (imports the big JSON; only import it in the 3D scene, server code, or scripts).
- `components/campus/RealCampusScene.tsx` draws all buildings as ONE merged mesh; colours and picking work through per-building vertex ranges in `lib/campus/geometry.ts`. Use `CampusCanvas` to embed it (handles client-only loading and fallbacks).
- A request's `area` is copied from its building in `createRequest`. The `buildings` table is loaded from the data files by the seed, keyed by `osm_id`.

## Testing
- `npm run test:e2e` (Playwright, `e2e/`): signs in with the seeded demo accounts against `.env.local`'s Supabase. Tests must clean up what they create (see `e2e/helpers.ts`). Keep the three role flows passing after any UI change; update selectors in `e2e/` when you rename buttons or labels.
- `npm run check:contrast` after colour changes; `npm run check:coverage` after changing building data or camera bounds.
- Heat thresholds live only in `lib/campus/heat.ts`.

## AI features (Active issues, Smart Sort)
- `lib/ai/provider.ts` is the ONLY file that imports `openai`. Everything else calls `generateStructured`. Never expose `OPENAI_API_KEY` (no `NEXT_PUBLIC_`), and keep provider imports out of Client Components.
- AI runs once per submission in `after()` (`lib/ai/service.ts` → `lib/ai/run.ts`); pages never call it. It must never block or fail a submission: any error → `ai_status = 'fallback'`.
- The safety rule lives in `lib/ai/safety.ts` and is applied in code after every model call. Don't rely on the prompt alone.
- Smart Sort reviews only requests reported Urgent/High (`ai_reviewed`). Medium/Low keep the reporter's urgency; `escalateForHazard` in `lib/ai/safety.ts` raises them for hazards (severe → Urgent, other → High). Medium/Low public requests still get one AI call, for duplicate grouping only. Private requests are never grouped.
- AI never writes `requests.priority` (the reporter's). AI → `ai_*` columns; technician choice → `triage_*`. Effective urgency: `lib/urgency.ts`.
- Every request has a `group_id` (issue group); `createRequest` creates the group + the reporter's vote. Schema changes go in a new file under `supabase/migrations/` AND in `schema.sql`.
- `npm run test:unit` (mocked AI) after changing `lib/ai/`. Playwright runs with `AI_PROVIDER=off`.

