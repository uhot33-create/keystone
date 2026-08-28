insert into dog_breeds (id, name, sort_order) values
  ('a1000000-0000-4000-8000-000000000027', 'アイリッシュセター', 215)
on conflict (name) do nothing;
