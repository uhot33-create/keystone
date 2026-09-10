create table if not exists dog_weight_logs (
  id           serial primary key,
  user_id      text not null,
  dog_id       integer not null references dogs (id) on delete cascade,
  log_date     date not null,
  weight_kg    numeric(6, 2) not null,
  measured_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists dog_weight_logs_dog_date_uq
  on dog_weight_logs (dog_id, log_date);

create index if not exists dog_weight_logs_user_date_idx
  on dog_weight_logs (user_id, log_date);
