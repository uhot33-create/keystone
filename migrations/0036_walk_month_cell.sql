alter table walk_month_tracks
  add column if not exists cell_m integer not null default 0;
