alter table calorie_logs add column if not exists amount numeric(8, 1);
alter table calorie_logs add column if not exists unit text;
