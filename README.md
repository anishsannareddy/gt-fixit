# GT FixIt 🛠️

**Georgia Tech Campus Solutions Challenge** — an all-in-one maintenance app for Georgia Tech.

- **Students & faculty** report issues in any building or dorm (with a photo) and track them.
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
cp .env.example .env.local     # then paste the 3 Supabase values (ask a teammate)
npm run dev                    # http://localhost:3000
```

**Test on your phone:** `npm run dev -- -H 0.0.0.0`, then open `http://<your-laptop-ip>:3000` on a phone on the same Wi-Fi.

## One-time Supabase setup (only one person does this)

1. Create a free project at [supabase.com](https://supabase.com) (region: East US).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Copy **Project URL**, **anon/publishable key**, and **service_role/secret key** from *Project Settings → API* into `.env.local`.
4. `npm run seed` — creates the photo bucket and loads ~45 real GT buildings, 6 demo personas and ~320 requests.

**Reset demo data anytime:** `npm run seed` (wipes and reloads). Dates are relative to today, so the dashboard always looks current. Run it the morning of the presentation.

> ⚠️ Supabase free projects pause after ~7 days of inactivity. Open the dashboard the day before the demo.

## Deploy to Vercel

1. Push to GitHub.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo (framework auto-detected).
3. Add the 3 environment variables from `.env.local` (Settings → Environment Variables).
4. Deploy. Every push to `main` redeploys; every pull request gets a preview URL.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (what Vercel runs — make sure it passes before pushing) |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run seed` | Reset & load demo data |

## How it works

```
app/
  page.tsx               Role picker (demo login)
  report/                Report form + photo upload (server actions in actions.ts)
  my-requests/           Reporter's request list
  requests/[id]/         Detail page + timeline + role-based actions
  requests/actions.ts    updateTicket(): every status change, with permission rules
  tech/                  Technician / admin queue with filters
  admin/                 Analytics dashboard
lib/
  supabase/server.ts     Service-role client (server only)
  demo-auth.ts           Cookie-based demo roles: getCurrentUser(), requireUser()
  data.ts                Shared queries
  analytics.ts           Dashboard aggregations
components/              UI pieces (cards, badges, pickers, charts)
supabase/schema.sql      Database tables
scripts/seed.ts          Demo data generator
proxy.ts                 Redirects to the role picker if no role chosen
```

- **Security model:** the browser never talks to the database. Every read and write goes through server code that uses the secret key; Row Level Security is on with no public policies. Photos upload straight from the browser to Storage with a one-time signed URL from our server.
- **Status flow:** `submitted → assigned → in_progress → resolved` (reporter or admin can reopen). Every change is stored in `request_events` for the timeline and analytics.

## Known limitations / next steps

- **Demo auth:** anyone can pick any role. Next: GT SSO (CAS) or Supabase Auth restricted to `@gatech.edu`, plus real RLS policies.
- Ideas: QR codes posted in each building that pre-fill the form · email/push notifications on status changes · duplicate-report detection · SLA alerts for urgent tickets · campus map view · AI-suggested category & priority from the photo.
