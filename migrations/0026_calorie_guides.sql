create table if not exists calorie_period_guides (
  user_id      text not null,
  dog_id       integer not null references dogs (id) on delete cascade,
  period_type  text not null,
  period_key   text not null,
  period_start date not null,
  period_end   date not null,
  guide_kcal   numeric(12, 1) not null,
  updated_at   timestamptz not null default now(),
  primary key (dog_id, period_type, period_key)
);

create index if not exists calorie_period_guides_dog_idx
  on calorie_period_guides (dog_id, period_type, period_start);
