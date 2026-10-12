-- おくすりの毎日の予定時刻。未設定の薬は案内を出さない。
alter table dog_medicines add column if not exists due_time time;
