insert into dog_breeds (id, name, sort_order)
select 'a1000000-0000-4000-8000-000000000029', 'ジャックラッセルテリア', 65
where not exists (
  select 1 from dog_breeds where name = 'ジャックラッセルテリア'
);
