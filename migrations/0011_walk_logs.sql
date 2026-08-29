create table if not exists walk_logs (
  id                text primary key,
  user_id           text not null,
  name              text not null,
  started_at        timestamptz,
  elapsed_sec       integer not null default 0,
  distance_m        numeric(10, 1) not null default 0,
  summary_polyline  text,
  source_name       text,
  created_at        timestamptz not null default now()
);

create index if not exists walk_logs_user_started_idx
  on walk_logs (user_id, started_at desc nulls last, created_at desc);
