-- わんカロリーの毎日の投薬。1つの薬につき1日1回まで。
create table if not exists dog_medicines (
  id          serial primary key,
  user_id     text not null,
  dog_id      integer not null references dogs (id) on delete cascade,
  name        text not null,
  note        text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists dog_medicines_dog_idx on dog_medicines (dog_id, sort_order, id);

create table if not exists dog_medicine_doses (
  id           serial primary key,
  user_id      text not null,
  dog_id       integer not null references dogs (id) on delete cascade,
  medicine_id  integer not null references dog_medicines (id) on delete cascade,
  given_on     date not null,
  given_at     timestamptz not null default now(),
  unique (medicine_id, given_on)
);
create index if not exists dog_medicine_doses_day_idx on dog_medicine_doses (dog_id, given_on);
