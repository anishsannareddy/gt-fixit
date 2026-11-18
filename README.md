# GT FixIt 🛠️
Made By: Anish Sannareddy, Anik Parikh, Arjun Shah, Pareen Sharma
**Georgia Tech Campus Solutions Challenge** — an all-in-one maintenance app for Georgia Tech.

- **Students & faculty** sign in with their @gatech.edu email, pick a building on a 3D campus map, report issues in any building or dorm (with a photo) and track them. **Active issues** shows what's already reported around campus; tap **Me too** instead of filing a duplicate.
- **Technicians** work a prioritized queue: claim → start → resolve. **Smart Sort** orders it by AI-rated urgency and how many students are affected.
- **Admins** get a live analytics dashboard: volume trends, top buildings, time-to-resolve, technician workload, and recurring hotspots.

Built with Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Storage) · Recharts · OpenAI (optional) · deployed on Vercel.

---

## Run it locally (each teammate)

Requires Node.js 22+.

```bash
git clone <your-repo-url>
cd gt-fixit
npm install
cp .env.example .env.local     # then paste the Supabase values (ask a teammate)
npm run dev                    # http://localhost:3000
```

**Test on your phone:** `npm run dev -- -H 0.0.0.0`, then open `http://<your-laptop-ip>:3000` on a phone on the same Wi-Fi.

## One-time Supabase setup (only one person does this)

1. Create a free project at [supabase.com](https://supabase.com) (region: East US).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   *Already set up before the AI features?* Instead paste [`supabase/migrations/001_ai_features.sql`](supabase/migrations/001_ai_features.sql) → **Run** (adds tables and columns only; keeps your data; safe to run twice), then [`002_visibility_review_delete.sql`](supabase/migrations/002_visibility_review_delete.sql) (private requests, Smart Sort review flag, request deletion), then [`003_building_aliases.sql`](supabase/migrations/003_building_aliases.sql) (searchable building aliases). Run them in order.
3. Copy **Project URL**, **anon/publishable key**, and **service_role/secret key** from *Project Settings → API* into `.env.local`.
4. **Authentication → Sign In / Providers:** keep **Email** enabled and turn **off** "Allow new users to sign up".
   Our server creates accounts itself (only for @gatech.edu emails), so public sign-up through the Supabase API must be closed.
5. `npm run seed` — creates the photo bucket, the 190 GT buildings, the demo sign-in accounts and ~320 requests.
   It prints the demo emails and password at the end.

**Reset demo data anytime:** `npm run seed` (wipes and reloads). Dates are relative to today, so the dashboard always looks current. Run it the morning of the presentation.

> ⚠️ Supabase free projects pause after ~7 days of inactivity. Open the dashboard the day before the demo.

## Sign-in and roles

- **Anyone with a @gatech.edu email** can create an account at `/login`. New accounts are always **students**.
- **Technician and admin** accounts are only created by `npm run seed`. There is no way to become one from the app.
- Roles are stored in our own `users` table, which the browser can't read or write (RLS on, no policies).
- After signing in: students → campus map, technicians → queue, admins → Command Center. Visiting another role's page sends you to your own home; visiting while signed out sends you to the landing page.

**Demo accounts** (created by the seed, all with the password in `DEMO_ACCOUNT_PASSWORD`, default `GTFixIt-Demo-2026!`):

| Role | Email |
|---|---|
| Student | demo.student@gatech.edu |
| Student (faculty) | demo.faculty@gatech.edu |
| Technician | demo.tech@gatech.edu (also demo.tech2, demo.tech3) |
| Admin | demo.admin@gatech.edu |

Set `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true` to list them (with the password) on the login page. **Turn it off after a public demo**, since anyone who sees the page can sign in as admin.

## Deploy to Vercel

1. Push to GitHub.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo (framework auto-detected).
3. Add the environment variables from `.env.local` (Settings → Environment Variables): the three Supabase values, `OPENAI_API_KEY` (optional, see [AI features](#ai-features)), plus `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` and `DEMO_ACCOUNT_PASSWORD` if you use them. Vercel needs Node.js 22+ (Settings → General → Node.js Version; `package.json` asks for it too).
4. Deploy. Every push to `main` redeploys; every pull request gets a preview URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (what Vercel runs — make sure it passes before pushing) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run seed` | Reset & load demo data (also recreates the demo accounts) |
| `npm run ai:backfill` | Run the real AI over existing open requests (needs `OPENAI_API_KEY`; flags: `--regroup`, `--all`, `--limit N`, `--dry-run`) |
| `npm run test:unit` | AI unit tests with a mocked AI (safety rule, validation, fallbacks, rate limit) |
| `npm run test:e2e` | Browser tests for all role flows, Active issues and Smart Sort (~4 min; builds the app first) |
| `npm run check:contrast` | WCAG contrast check for every text/background colour pair |
| `npm run check:coverage` | Every database building is in the 3D map; shows heat-map bands |

## Testing

### Unit (`npm run test:unit`)
Node's built-in test runner, no network. The AI provider and database are mocked (`lib/ai/test-helpers.ts`). Covers: hazards are never downgraded, severe hazards are at least High, low confidence keeps the reporter's urgency, only candidate group ids are accepted, invalid output and timeouts fall back, injected instructions stay inside the data block, the rate limit skips the AI call, and merging moves votes and deletes the empty group.

### Automated (`npm run test:e2e`)
Playwright drives a real browser against a production build, using the demo accounts and your Supabase project. Tests create their own requests and delete them afterwards. The test server runs with `AI_PROVIDER=off`, so tests never call OpenAI (and they check the no-AI path). First time only: `npx playwright install chromium`.

| Spec | What it proves |
|---|---|
| `e2e/flows.spec.ts` | Student reports via search → success screen → My requests; technician claims, starts, resolves; student sees the note and reopens; admin filters by building, opens the drawer, changes priority, adds a note, assigns; technician sees it in My work; Analytics loads |
| `e2e/guards.spec.ts` | Signed-out and wrong-role visits redirect; non-GT sign-up rejected; students can't open others' requests; sign out works |
| `e2e/map.spec.ts` | Heat legend (OK / Busy / Hot spot), Areas toggle, Reset view on student and admin maps |
| `e2e/issues.spec.ts` | Me too adds a vote, survives reload, Undo removes it; reporter sees "You reported this"; reports and timeline expand; tapping a building lists its issues first; the report form suggests a match; with AI off, submitting still works |
| `e2e/smart-sort.spec.ts` | Smart Sort from the account menu; AI-urgent first; "AI disagrees" on the light bulb; one-tap override persists; turning it off restores the old order |

### Manual checklist (what the tests can't do)
Headless browsers can't reliably click 3D buildings, use touch gestures or a phone camera. Before a demo, run through this on a **laptop** and a **phone** (`npm run dev`, then open the Network URL it prints on the phone, same Wi-Fi):

**Landing and sign-in**
- [ ] Landing: 3D campus rotates slowly; headline readable over it
- [ ] Login → open **Demo accounts** → tap one → fills the form → signs in

**Student (demo.student)**
- [ ] Hover a GT building (laptop): label shows name + area; city buildings don't react
- [ ] Tap a building (phone) opens the bottom sheet; dragging the map does **not** select
- [ ] Camera flies to the building and keeps it visible above the sheet / beside the panel
- [ ] Sheet: drag the handle down to close (phone); Esc closes (laptop)
- [ ] Report with a photo **taken with the phone camera** → success screen → View request shows the photo
- [ ] **Reset view** flies back to the whole campus

**Active issues (demo.student / demo.faculty)**
- [ ] Active issues tab: Glenn ceiling leak says "You reported this" (Alex); Towers lounge leak has a Me too button
- [ ] Tap Glenn or Towers on the map: its active issues show first, then **Report a new issue**
- [ ] With `OPENAI_API_KEY` set: report "water dripping from the ceiling in the lounge" in Towers → within a few seconds it joins the existing issue (count goes up)

**Technician (demo.tech)**
- [ ] Account menu → Smart Sort on: gas smell near the top ("AI: Urgent (reported Low)", Safety); light bulb shows "AI: Low (reported Urgent)" + "AI disagrees"
- [ ] Tap a badge → reason → tap another urgency → reload, it stuck
- [ ] On the phone: Claim → Start work → Resolve (note sheet) with one thumb
- [ ] Student's My requests updates within ~15 s (or on switching back to the tab)

**Admin (demo.admin)**
- [ ] Heat map: Glenn and Towers red with pins and pulsing rings, Clough and Howey yellow (fresh seed)
- [ ] Click a building → list filters, chip shows its name; click again → filter clears
- [ ] Click a row → drawer; every action shows a toast and appears on the timeline
- [ ] Free camera: drag rotate, right-drag / two-finger pan, scroll / pinch zoom; can't fly off the map
- [ ] Areas toggle shows the area colours and legend

**Accessibility**
- [ ] System setting "Reduce motion" on: no orbit, pins don't pulse, camera jumps instead of flying
- [ ] Keyboard only: Tab through login, report form, drawer (focus stays inside the drawer; Esc closes)

## AI features

Two features use OpenAI's small, low-cost model (`gpt-6-luna` by default). **Both are optional:** without a key the app works exactly the same, and the seeded demo data already contains AI ratings, so the demo works even if the API is down.

- **Active issues (students):** every request belongs to an *issue group* (a group of one if it's unique). When a request is submitted, the AI compares it with open requests in the same building from the last 30 days. If it's the same underlying problem, the request joins that group and the AI writes a short, clean title. Students tap **Me too** on a group (one vote per student; the reporter counts as the first). The report form also suggests matching issues while you type.
- **Smart Sort (technicians):** the AI rates each request's real urgency (Low to Urgent) with a one-sentence reason, from the description, category, building type and number of students affected. With Smart Sort on, the queue sorts by that urgency, then students affected, then age. Badges show "AI: Medium (reported Urgent)" and flag disagreements. A technician can accept or override in one tap; that choice is saved and logged on the timeline.

**Rules the code enforces:**
- **AI only suggests.** The reporter's urgency is never changed; the AI's rating (`ai_urgency`, `ai_reason`, `ai_category`) and the technician's choice (`triage_urgency`) are stored separately.
- **Runs once, at submission,** after the response is sent (Next.js `after()`), so reporting never waits for it. Pages only read stored results.
- **Safety rule** (`lib/ai/safety.ts`): gas, fire/smoke, sparking or exposed wiring, flooding, structural damage, blocked exits, elevator entrapment, broken locks and injury risks are never rated below the reporter's urgency; clear hazards are never below High; when the model isn't confident, the reporter's urgency stands.
- **Untrusted text:** request text is sent as escaped JSON inside data tags and the instructions say never to follow it. Lengths are capped. Every response uses a strict JSON schema and is validated again with zod, and only group ids we offered are accepted.
- **Rate limit:** 15 submissions and 40 suggestion lookups per user per hour (stored in `ai_calls`).
- **Fallback:** if the key is missing, the API fails or times out (8 s), or the limit is hit, the request keeps the reporter's urgency, stays its own group, and is marked `ai_status = fallback`. Nothing is shown to the student.

**Setup:** add `OPENAI_API_KEY=...` to `.env.local` (and to Vercel). It is server-only: never give it a `NEXT_PUBLIC_` name. Optional: `OPENAI_MODEL` to use a different model, `AI_PROVIDER=off` to disable AI. To replace the seeded ratings with real ones: `npm run ai:backfill` (try `-- --dry-run --limit 10` first). It costs about $0.02 for the whole demo database.

**Switching providers:** all provider code is in `lib/ai/provider.ts` (`generateStructured`). Replace that one file.

## How it works

```
app/
  page.tsx               Landing page
  login/                 Sign in / create account (+ demo accounts box)
  report/                Report form + photo upload (server actions in actions.ts)
  my-requests/           Reporter's request list
  requests/[id]/         Detail page + timeline + role-based actions
  requests/actions.ts    Every request change (updateTicket, setStatus, setPriority, addNote) with permission rules
  issues/                Active issues tab (students) + toggleVote ("Me too")
  tech/                  Technician queue: one-tap Claim / Start / Resolve cards, Smart Sort (actions.ts)
  admin/                 Command Center (map + table + drawer); admin/analytics/ for charts
lib/
  supabase/server.ts     Service-role client (server only)
  auth.ts                Supabase Auth session + role from the users table: getCurrentUser(), requireUser()
  data.ts                Shared queries
  analytics.ts           Dashboard aggregations
  issues.ts              Active issue groups, votes and anonymised reports
  urgency.ts             Effective urgency (technician > AI > reporter) and the Smart Sort order
  ai/                    provider.ts (only OpenAI file), triage.ts (prompts + validation), safety.ts,
                         run.ts (store results, merge groups, rate limit), service.ts (after submission)
components/              ui/ (design system), tickets/ (card, detail, timeline, actions),
                         campus/ (3D map, legends), shell/ (layouts, nav, user menu), charts/
e2e/                     Playwright tests
supabase/schema.sql      Database tables (supabase/migrations/ for upgrading an existing database)
scripts/seed.ts          Demo data generator (incl. duplicate groups and pre-baked AI ratings)
scripts/ai-backfill.ts   Run the real AI over existing requests
proxy.ts                 Refreshes the sign-in session; logged-out visitors go to the landing page
```

- **Security model:** the browser never talks to the database. Every read and write goes through server code that uses the secret key; Row Level Security is on with no public policies. Photos upload straight from the browser to Storage with a one-time signed URL from our server.
- **Status flow:** `submitted → assigned → in_progress → resolved` (reporter or admin can reopen). Every change is stored in `request_events` for the timeline and analytics.

## Known limitations / next steps

- **Sign-in** is email + password with no email verification (accounts are created on the server). Next: GT single sign-on (CAS), or Supabase email verification with a real email provider.
- Ideas: QR codes posted in each building that pre-fill the form · email/push notifications on status changes · SLA alerts for urgent tickets · campus map view · AI reading the photo too · resolve every report in an issue group at once.


### Building names
Building names, areas and search aliases come from `data/campus.json` + `data/zones.json`, corrected in `data/zone-overrides.json` (see `data/building-name-changes.md`). `npm run buildings:sync` updates the live `buildings` table in place; building ids never change, so existing requests keep their building.

### Deleting requests
- Students can delete their own request while it's Submitted or Assigned. Admins can delete any request (spam, duplicates, mistakes). Technicians can't. The server enforces this (`lib/permissions.ts`).
- Deleting is permanent and happens in one database transaction (`delete_request()` in migration 002). It removes the request, its history, its issue-group membership (an emptied group goes, along with its votes), and its photo in Storage.
- Only a minimal audit row is kept in `deletion_log`: the request id, who deleted it, their role and the time. Old links show "This request was removed".
