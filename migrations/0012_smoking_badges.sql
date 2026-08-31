alter table smoking_settings
  add column if not exists exceeded boolean not null default false;

create table if not exists smoking_badges (
  user_id              text primary key,
  nice_count           integer not null default 0,
  very_nice_count      integer not null default 0,
  wonderful_count      integer not null default 0,
  last_evaluated_on    date,
  updated_at           timestamptz not null default now()
);
