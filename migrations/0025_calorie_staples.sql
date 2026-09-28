create table if not exists calorie_staples (
  id          serial primary key,
  user_id     text not null,
  dog_id      integer not null references dogs (id) on delete cascade,
  food_id     integer not null references dog_foods (id) on delete cascade,
  qty         numeric(8, 1) not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists calorie_staples_dog_idx on calorie_staples (dog_id, sort_order, id);

insert into calorie_staples (user_id, dog_id, food_id, qty, sort_order)
select f.user_id, f.dog_id, f.id, v.qty, v.sort_order
from dog_foods f
join (
  values
    ('NOWフレッシュ', 15::numeric, 1),
    ('ささみジャーキー', 2::numeric, 2),
    ('ささみジャーキー', 4::numeric, 3)
) as v(name, qty, sort_order) on f.name = v.name
where not exists (
  select 1
  from calorie_staples s
  where s.dog_id = f.dog_id and s.food_id = f.id and s.qty = v.qty
);
