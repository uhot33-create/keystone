alter table vet_visits
  add column if not exists visit_time text,
  add column if not exists next_visit_time text,
  add column if not exists next_visit_status text;

update vet_visits
set next_visit_status = 'booked'
where next_visit_on is not null
  and next_visit_status is null;
