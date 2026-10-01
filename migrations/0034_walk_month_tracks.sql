create table if not exists walk_month_tracks (
  user_id      text not null,
  year_month   text not null,
  distance_m   numeric(12, 1) not null default 0,
  elapsed_sec  integer not null default 0,
  log_count    integer not null default 0,
  polylines    jsonb not null default '[]'::jsonb,
  computed_at  timestamptz not null default now(),
  primary key (user_id, year_month)
);
