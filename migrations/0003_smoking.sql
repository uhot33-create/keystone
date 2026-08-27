create table if not exists smoking_settings (
  id                 serial primary key,
  user_id            text not null,
  daily_limit        integer not null default 10,
  remaining          integer not null default 10,
  period_started_at  timestamptz not null default now(),
  last_smoked_at     timestamptz,
  updated_at         timestamptz not null default now()
);
create unique index if not exists smoking_settings_user_id_uq on smoking_settings (user_id);
