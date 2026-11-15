-- GT FixIt migration 001: AI features (Active issues + Smart Sort)
-- Paste this whole file into Supabase → SQL Editor → "Run".
-- Safe to run on a database that already has data: it only ADDS tables and columns,
-- and it is safe to run twice. (supabase/schema.sql already includes all of this for fresh installs.)

-- 1. Issue groups: duplicate reports of the same underlying problem share a group.
--    Every request belongs to exactly one group (a group of one if it's unique).
create table if not exists issue_groups (
  id           bigint generated always as identity primary key,
  building_id  bigint not null references buildings(id),
  category     text not null,
  title        text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists issue_groups_building_idx on issue_groups (building_id);

-- 2. "Me too" votes: one per student per group. The reporter of each report is also a vote.
create table if not exists group_votes (
  group_id    bigint not null references issue_groups(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_votes_user_idx on group_votes (user_id);

-- 3. AI call log, used to rate-limit AI calls per user (works across serverless instances).
create table if not exists ai_calls (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete cascade,
  kind        text not null check (kind in ('triage', 'similar')),
  created_at  timestamptz not null default now()
);
create index if not exists ai_calls_user_idx on ai_calls (user_id, kind, created_at);

-- 4. AI + technician triage fields on requests. The reporter's own `priority` is never changed by AI.
alter table requests add column if not exists group_id        bigint references issue_groups(id);
alter table requests add column if not exists ai_urgency      text check (ai_urgency in ('low', 'medium', 'high', 'urgent'));
alter table requests add column if not exists ai_reason       text;
alter table requests add column if not exists ai_category     text;
alter table requests add column if not exists ai_safety       boolean not null default false;
alter table requests add column if not exists ai_status       text not null default 'pending' check (ai_status in ('pending', 'done', 'fallback'));
alter table requests add column if not exists ai_model        text;
alter table requests add column if not exists ai_at           timestamptz;
alter table requests add column if not exists triage_urgency  text check (triage_urgency in ('low', 'medium', 'high', 'urgent'));
alter table requests add column if not exists triage_by       uuid references users(id);
alter table requests add column if not exists triage_at       timestamptz;
create index if not exists requests_group_idx on requests (group_id);

-- 5. Per-user Smart Sort setting (technician queue).
alter table users add column if not exists smart_sort boolean not null default false;

-- 6. Existing requests: give each one its own group, with its reporter as the first vote.
do $$
declare r record; gid bigint;
begin
  for r in select id, building_id, category, title, reporter_id, created_at from requests where group_id is null order by id loop
    insert into issue_groups (building_id, category, title, created_at, updated_at)
      values (r.building_id, r.category, r.title, r.created_at, r.created_at) returning id into gid;
    update requests set group_id = gid where id = r.id;
    insert into group_votes (group_id, user_id, created_at) values (gid, r.reporter_id, r.created_at) on conflict do nothing;
  end loop;
end $$;

alter table requests alter column group_id set not null;

-- 7. Same rule as every other table: RLS on, no policies → the browser key can't touch these.
alter table issue_groups enable row level security;
alter table group_votes  enable row level security;
alter table ai_calls     enable row level security;
