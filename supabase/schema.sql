-- GT FixIt database schema
-- Paste this whole file into Supabase → SQL Editor → "Run".
-- ⚠️ It DROPS and recreates the tables, so running it again wipes all data.
--    (Then run `npm run seed` to load demo data.)

drop table if exists ai_calls cascade;
drop table if exists group_votes cascade;
drop table if exists request_events cascade;
drop table if exists requests cascade;
drop table if exists issue_groups cascade;
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
  smart_sort  boolean not null default false, -- technician queue: sort by AI urgency
  created_at  timestamptz not null default now()
);

-- Issue groups: duplicate reports of the same underlying problem share a group.
-- Every request belongs to exactly one group (a group of one if it's unique).
create table issue_groups (
  id           bigint generated always as identity primary key,
  building_id  bigint not null references buildings(id),
  category     text not null,
  title        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
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
  group_id         bigint not null references issue_groups(id),
  -- AI suggestions (set once at submission). AI never changes the reporter's `priority`.
  ai_urgency       text check (ai_urgency in ('low', 'medium', 'high', 'urgent')),
  ai_reason        text,
  ai_category      text,
  ai_safety        boolean not null default false,
  ai_status        text not null default 'pending' check (ai_status in ('pending', 'done', 'fallback')),
  ai_model         text,
  ai_at            timestamptz,
  -- Technician's accepted/overridden urgency
  triage_urgency   text check (triage_urgency in ('low', 'medium', 'high', 'urgent')),
  triage_by        uuid references users(id),
  triage_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

-- "Me too" votes: one per student per group. Each report's reporter is also a vote.
create table group_votes (
  group_id    bigint not null references issue_groups(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- AI call log, used to rate-limit AI calls per user.
create table ai_calls (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete cascade,
  kind        text not null check (kind in ('triage', 'similar')),
  created_at  timestamptz not null default now()
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
create index requests_group_idx      on requests (group_id);
create index issue_groups_building_idx on issue_groups (building_id);
create index group_votes_user_idx    on group_votes (user_id);
create index ai_calls_user_idx       on ai_calls (user_id, kind, created_at);

-- Row Level Security ON with no policies = the public/anon key can't read or write
-- these tables at all. Our Next.js server uses the service-role key, which bypasses RLS.
alter table buildings      enable row level security;
alter table users          enable row level security;
alter table requests       enable row level security;
alter table request_events enable row level security;
alter table issue_groups   enable row level security;
alter table group_votes    enable row level security;
alter table ai_calls       enable row level security;
