# GT FixIt 🛠️

**Georgia Tech Campus Solutions Challenge** — an all-in-one maintenance app for Georgia Tech.

- **Students & faculty** sign in with their @gatech.edu email, pick a building on a 3D campus map, report issues in any building or dorm (with a photo) and track them.
- **Technicians** work a prioritized queue: claim → start → resolve.
- **Admins** get a live analytics dashboard: volume trends, top buildings, time-to-resolve, technician workload, and recurring hotspots.

Built with Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Storage) · Recharts · deployed on Vercel.

---

## Run it locally (each teammate)

Requires Node.js 20+.

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
3. Add the environment variables from `.env.local` (Settings → Environment Variables): the three Supabase values, plus `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` and `DEMO_ACCOUNT_PASSWORD` if you use them.
4. Deploy. Every push to `main` redeploys; every pull request gets a preview URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (what Vercel runs — make sure it passes before pushing) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run seed` | Reset & load demo data (also recreates the demo accounts) |
| `npm run test:e2e` | Browser tests for all three role flows (~1 min; builds the app first) |
| `npm run check:contrast` | WCAG contrast check for every text/background colour pair |
| `npm run check:coverage` | Every database building is in the 3D map; shows heat-map bands |

## Testing

### Automated (`npm run test:e2e`)
Playwright drives a real browser against a production build, using the demo accounts and your Supabase project. Tests create their own requests and delete them afterwards. First time only: `npx playwright install chromium`.

| Spec | What it proves |
|---|---|
| `e2e/flows.spec.ts` | Student reports via search → success screen → My requests; technician claims, starts, resolves; student sees the note and reopens; admin filters by building, opens the drawer, changes priority, adds a note, assigns; technician sees it in My work; Analytics loads |
| `e2e/guards.spec.ts` | Signed-out and wrong-role visits redirect; non-GT sign-up rejected; students can't open others' requests; sign out works |
| `e2e/map.spec.ts` | Heat legend (OK / Busy / Hot spot), Areas toggle, Reset view on student and admin maps |

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

**Technician (demo.tech)**
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

## How it works

```
app/
  page.tsx               Landing page
  login/                 Sign in / create account (+ demo accounts box)
  report/                Report form + photo upload (server actions in actions.ts)
  my-requests/           Reporter's request list
  requests/[id]/         Detail page + timeline + role-based actions
  requests/actions.ts    Every request change (updateTicket, setStatus, setPriority, addNote) with permission rules
  tech/                  Technician queue: one-tap Claim / Start / Resolve cards
  admin/                 Command Center (map + table + drawer); admin/analytics/ for charts
lib/
  supabase/server.ts     Service-role client (server only)
  auth.ts                Supabase Auth session + role from the users table: getCurrentUser(), requireUser()
  data.ts                Shared queries
  analytics.ts           Dashboard aggregations
components/              ui/ (design system), tickets/ (card, detail, timeline, actions),
                         campus/ (3D map, legends), shell/ (layouts, nav, user menu), charts/
e2e/                     Playwright tests
supabase/schema.sql      Database tables
scripts/seed.ts          Demo data generator
proxy.ts                 Refreshes the sign-in session; logged-out visitors go to the landing page
```

- **Security model:** the browser never talks to the database. Every read and write goes through server code that uses the secret key; Row Level Security is on with no public policies. Photos upload straight from the browser to Storage with a one-time signed URL from our server.
- **Status flow:** `submitted → assigned → in_progress → resolved` (reporter or admin can reopen). Every change is stored in `request_events` for the timeline and analytics.

## Known limitations / next steps

- **Sign-in** is email + password with no email verification (accounts are created on the server). Next: GT single sign-on (CAS), or Supabase email verification with a real email provider.
- Ideas: QR codes posted in each building that pre-fill the form · email/push notifications on status changes · duplicate-report detection · SLA alerts for urgent tickets · campus map view · AI-suggested category & priority from the photo.
