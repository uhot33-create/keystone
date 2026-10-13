-- 投与の記録を始める日。これより前の日は画面で「—」。
-- いま登録済みの薬は、機能追加の翌日から記録する。
alter table dog_medicines add column if not exists tracked_from date;
update dog_medicines
set tracked_from = date '2026-10-12'
where tracked_from is null;
alter table dog_medicines alter column tracked_from set default ((timezone('Asia/Tokyo', now()))::date);
alter table dog_medicines alter column tracked_from set not null;
