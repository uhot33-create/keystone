-- 毎日ではない手入れ。最後にやった日だけを残す。
create table if not exists dog_cares (
  id           serial primary key,
  user_id      text not null,
  dog_id       integer not null references dogs (id) on delete cascade,
  name         text not null,
  last_done_on date,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists dog_cares_dog_idx on dog_cares (dog_id, sort_order, id);
