create table if not exists dog_colors (
  id          text primary key,
  name        text not null unique,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into dog_colors (id, name, sort_order) values
  ('c1000000-0000-4000-8000-000000000001', '白', 10),
  ('c1000000-0000-4000-8000-000000000002', '茶', 20),
  ('c1000000-0000-4000-8000-000000000003', 'こげ茶', 30),
  ('c1000000-0000-4000-8000-000000000004', '黒', 40),
  ('c1000000-0000-4000-8000-000000000005', '黒／茶', 50)
on conflict (name) do nothing;

alter table memos add column if not exists color_id text references dog_colors(id);

update memos
set color_id = dog_colors.id
from dog_colors
where memos.color_id is null
  and memos.color is not null
  and memos.color = dog_colors.name;
