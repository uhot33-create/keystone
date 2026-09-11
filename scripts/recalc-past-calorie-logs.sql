-- 昨日まで（JST）の摂取カロリーを、小数第1位・切り捨てで再計算する。
-- 今日の記録は変更しない。
-- Neon SQL Editor で、確認 → 更新 の順に実行する。

-- 1. 確認（書き換えない）
select ((now() at time zone 'Asia/Tokyo')::date - 1) as until;

select
  l.id,
  l.log_date,
  l.label,
  l.amount,
  l.unit,
  l.kcal as kcal_now,
  trunc((f.kcal / f.amount) * l.amount, 1) as kcal_new
from calorie_logs l
join dog_foods f on f.id = l.food_id
where l.log_date <= ((now() at time zone 'Asia/Tokyo')::date - 1)
  and l.amount is not null
  and l.amount > 0
  and f.amount > 0
order by l.log_date, l.id;

-- 2. 更新（確認してから実行）
update calorie_logs as l
set kcal = trunc((f.kcal / f.amount) * l.amount, 1)
from dog_foods as f
where l.food_id = f.id
  and l.log_date <= ((now() at time zone 'Asia/Tokyo')::date - 1)
  and l.amount is not null
  and l.amount > 0
  and f.amount > 0;

update calorie_logs
set kcal = trunc(kcal, 1)
where log_date <= ((now() at time zone 'Asia/Tokyo')::date - 1)
  and (food_id is null or amount is null or amount <= 0);
