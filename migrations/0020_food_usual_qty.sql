alter table dog_foods
  add column if not exists usual_qty numeric(8, 1);

update dog_foods
set usual_qty = amount
where usual_qty is null;
