alter table smoking_badges
  add column if not exists lifetime_nice integer not null default 0,
  add column if not exists streak integer not null default 0,
  add column if not exists zero_streak integer not null default 0,
  add column if not exists light_count integer not null default 0,
  add column if not exists zero_count integer not null default 0,
  add column if not exists quiet_week_count integer not null default 0,
  add column if not exists recover_count integer not null default 0,
  add column if not exists limit_down_count integer not null default 0,
  add column if not exists start_earned boolean not null default false,
  add column if not exists week_earned boolean not null default false,
  add column if not exists month_earned boolean not null default false,
  add column if not exists hundred_earned boolean not null default false,
  add column if not exists last_was_exceeded boolean not null default false;
