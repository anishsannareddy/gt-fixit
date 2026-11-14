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
- Demo auth: `requireUser(roles)` from `lib/demo-auth.ts` at the top of every page and server action.
- Status changes go through `updateTicket` in `app/requests/actions.ts`, which writes a `request_events` row. Keep that invariant.
- Schema: `supabase/schema.sql`. If you change it, update `lib/types.ts` and `scripts/seed.ts`, and tell the user to re-run the SQL in Supabase.

## Checks before finishing a change
`npm run lint && npm run typecheck && npm run build`
