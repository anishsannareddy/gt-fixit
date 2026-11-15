-- GT FixIt database schema
-- Paste this whole file into Supabase → SQL Editor → "Run".
-- ⚠️ It DROPS and recreates the tables, so running it again wipes all data.
--    (Then run `npm run seed` to load demo data.)

drop table if exists request_events cascade;
drop table if exists requests cascade;
drop table if exists users cascade;
drop table if exists buildings cascade;

-- GT buildings (from OpenStreetMap footprints + the GT Facilities maintenance-area map).
-- Loaded by `npm run seed` from data/campus.json + data/zones.json.
create table buildings (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  short_name  text,
  type        text not null check (type in ('residence', 'academic', 'dining', 'athletic', 'other')),
  number      text,                 -- GT building number, when known
  -- GT Facilities maintenance area that looks after this building
  area        text not null check (area in ('area1', 'area2', 'area3', 'area4', 'area5', 'area6', 'gtaa', 'housing', 'parking')),
  lat         double precision,
  lng         double precision,
  osm_id      text unique           -- OpenStreetMap id; links the row to its 3D footprint
);

-- People. For anyone who can sign in, `id` is their Supabase Auth user id.
-- ROLES live here, not in Auth: the browser can't read or write this table (RLS on, no policies),
-- so nobody can promote themselves. Technician/admin rows are only created by `npm run seed`.
-- Seeded background reporters (fake students who own demo requests) have no login.
create table users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique,
  role        text not null check (role in ('reporter', 'technician', 'admin')),
  title       text,                          -- e.g. "3rd-year CS student", "HVAC Technician"
  is_demo     boolean not null default false, -- seeded demo account (listed on the login page when enabled)
  created_at  timestamptz not null default now()
);

-- Maintenance requests ("tickets"). IDs start at 1001 so they look like ticket numbers.
create table requests (
  id               bigint generated always as identity (start with 1001) primary key,
  title            text not null,
  description      text not null default '',
  building_id      bigint not null references buildings(id),
  location_detail  text not null default '',
  -- Maintenance area, copied from the building when the request is created (used for routing)
  area             text not null check (area in ('area1', 'area2', 'area3', 'area4', 'area5', 'area6', 'gtaa', 'housing', 'parking')),
  category         text not null,
  priority         text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status           text not null default 'submitted'
                     check (status in ('submitted', 'assigned', 'in_progress', 'resolved')),
  reporter_id      uuid not null references users(id),
  assignee_id      uuid references users(id),
  photo_url        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

-- Status history for each request (powers the timeline + analytics)
create table request_events (
  id           bigint generated always as identity primary key,
  request_id   bigint not null references requests(id) on delete cascade,
  actor_id     uuid references users(id),
  from_status  text,
  to_status    text not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index requests_status_idx     on requests (status);
create index requests_building_idx   on requests (building_id);
create index requests_created_idx    on requests (created_at);
create index requests_assignee_idx   on requests (assignee_id);
create index requests_reporter_idx   on requests (reporter_id);
create index requests_area_idx       on requests (area);
create index request_events_req_idx  on request_events (request_id);

-- Row Level Security ON with no policies = the public/anon key can't read or write
-- these tables at all. Our Next.js server uses the service-role key, which bypasses RLS.
alter table buildings      enable row level security;
alter table users          enable row level security;
alter table requests       enable row level security;
alter table request_events enable row level security;
