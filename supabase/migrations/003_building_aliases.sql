-- GT FixIt migration 003: searchable alternative names for buildings (old names, map labels).
-- Paste into Supabase → SQL Editor → "Run". Safe to run twice; keeps all data.
alter table buildings add column if not exists aliases text[] not null default '{}';
