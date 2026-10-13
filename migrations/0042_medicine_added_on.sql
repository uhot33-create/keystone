-- おくすり機能を追加した日。この日以前の投与状態は「—」、翌日以降は済か未。
create table if not exists app_settings (
  key   text primary key,
  value text not null
);
insert into app_settings (key, value)
values ('medicine_added_on', '2026-10-11')
on conflict (key) do nothing;
