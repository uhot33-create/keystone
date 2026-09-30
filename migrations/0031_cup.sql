create table if not exists cup_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  name            text not null,
  image_url       text,
  image_pathname  text,
  created_at      timestamptz not null default now()
);
create index if not exists cup_items_user_name_idx on cup_items (user_id, name);

create table if not exists cup_stocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  item_id     uuid references cup_items (id) on delete set null,
  item_name   text not null,
  expires_on  date not null,
  quantity    integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cup_stocks_quantity_nonneg check (quantity >= 0)
);
create index if not exists cup_stocks_user_expiry_idx on cup_stocks (user_id, expires_on);
