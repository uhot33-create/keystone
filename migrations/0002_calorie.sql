create table if not exists dogs (
  id                 serial primary key,
  user_id            text not null,
  name               text not null,
  current_weight_kg  numeric(6, 2) not null default 0,
  ideal_weight_kg    numeric(6, 2) not null default 0,
  life_stage         text not null default 'adult_neutered',
  treat_ratio        numeric(4, 2) not null default 0.10,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists dogs_user_id_uq on dogs (user_id);

create table if not exists dog_foods (
  id              serial primary key,
  user_id         text not null,
  dog_id          integer not null references dogs (id) on delete cascade,
  name            text not null,
  kind            text not null,
  kcal            numeric(8, 1) not null,
  amount          numeric(8, 1) not null default 1,
  unit            text not null default 'g',
  created_at      timestamptz not null default now()
);
create index if not exists dog_foods_user_id_idx on dog_foods (user_id);
create index if not exists dog_foods_dog_id_idx on dog_foods (dog_id);

create table if not exists calorie_logs (
  id          serial primary key,
  user_id     text not null,
  dog_id      integer not null references dogs (id) on delete cascade,
  log_date    date not null,
  label       text not null,
  kcal        numeric(8, 1) not null,
  kind        text not null default 'other',
  food_id     integer references dog_foods (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists calorie_logs_user_date_idx on calorie_logs (user_id, log_date);
create index if not exists calorie_logs_dog_date_idx on calorie_logs (dog_id, log_date);
