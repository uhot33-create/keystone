alter table walk_month_tracks
  add column if not exists regions jsonb not null default '[]'::jsonb;
