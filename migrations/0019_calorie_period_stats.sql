create table if not exists calorie_period_stats (
  user_id      text not null,
  dog_id       integer not null references dogs (id) on delete cascade,
  period_type  text not null,
  period_key   text not null,
  period_start date not null,
  period_end   date not null,
  kcal_total   numeric(12, 1) not null default 0,
  weight_kg    numeric(6, 2),
  computed_at  timestamptz not null default now(),
  primary key (dog_id, period_type, period_key)
);

create index if not exists calorie_period_stats_user_type_idx
  on calorie_period_stats (user_id, period_type, period_end);
