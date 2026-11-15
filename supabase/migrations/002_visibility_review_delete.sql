-- GT FixIt migration 002: private requests, Smart Sort review flag, deleting requests.
-- Paste this whole file into Supabase → SQL Editor → "Run".
-- Safe on a database that already has data, and safe to run twice.
-- (supabase/schema.sql already includes all of this for fresh installs.)

-- 1. Public / private requests. Private ones are seen only by the reporter, technicians and admins.
--    They never join an issue group with other reports and never appear in Active issues.
alter table requests add column if not exists visibility text not null default 'public';
do $$ begin
  alter table requests add constraint requests_visibility_check check (visibility in ('public', 'private'));
exception when duplicate_object then null; end $$;

-- 2. Smart Sort: true when the AI actually reviewed the urgency (reporter said Urgent/High),
--    or when a Medium/Low request was escalated because it describes a safety hazard.
alter table requests add column if not exists ai_reviewed boolean not null default false;
update requests set ai_reviewed = true where ai_status = 'done' and priority in ('urgent', 'high') and not ai_reviewed;

-- 3. Minimal audit record for deleted requests: no request content, just who and when.
create table if not exists deletion_log (
  id          bigint generated always as identity primary key,
  request_id  bigint not null,
  deleted_by  uuid references users(id) on delete set null,
  role        text not null,
  deleted_at  timestamptz not null default now()
);
create index if not exists deletion_log_request_idx on deletion_log (request_id);
alter table deletion_log enable row level security;

-- 4. Hard delete in one transaction. Removes the request and its history (request_events
--    cascade), and fixes up its issue group: an empty group is deleted with its votes; otherwise
--    the deleted reporter's vote goes (unless they reported another request in the group) and
--    the group title is refreshed if it was this request's title. Returns the photo URL so the
--    server can delete the file from Storage. Permission checks happen in the server action.
create or replace function delete_request(p_id bigint, p_actor uuid, p_role text)
returns table (photo_url text, group_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  next_title text;
begin
  select q.id, q.group_id, q.reporter_id, q.photo_url, q.title into r from requests q where q.id = p_id for update;
  if not found then
    return;
  end if;

  delete from requests where id = p_id;

  if not exists (select 1 from requests q where q.group_id = r.group_id) then
    delete from issue_groups where id = r.group_id;
  else
    if not exists (select 1 from requests q where q.group_id = r.group_id and q.reporter_id = r.reporter_id) then
      delete from group_votes v where v.group_id = r.group_id and v.user_id = r.reporter_id;
    end if;
    select q.title into next_title from requests q where q.group_id = r.group_id order by q.created_at limit 1;
    update issue_groups g
      set title = case when g.title = r.title then next_title else g.title end,
          updated_at = now()
      where g.id = r.group_id;
  end if;

  insert into deletion_log (request_id, deleted_by, role) values (p_id, p_actor, p_role);
  return query select r.photo_url::text, r.group_id::bigint;
end $$;

-- Only the server (service role) may call it.
revoke all on function delete_request(bigint, uuid, text) from public, anon, authenticated;
