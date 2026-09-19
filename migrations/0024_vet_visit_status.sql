alter table vet_visits
  add column if not exists status text not null default 'done';

update vet_visits
set status = 'done'
where status is null or status not in ('planned', 'done');

insert into vet_visits (
  id, user_id, visit_on, clinic_name, kind, title, status, created_at, updated_at
)
select
  gen_random_uuid(),
  v.user_id,
  v.next_visit_on,
  v.clinic_name,
  v.kind,
  v.title,
  'planned',
  now(),
  now()
from vet_visits v
where v.next_visit_on is not null
  and v.next_visit_on >= current_date
  and v.status = 'done'
  and not exists (
    select 1
    from vet_visits p
    where p.user_id = v.user_id
      and p.visit_on = v.next_visit_on
      and coalesce(btrim(p.clinic_name), '') = coalesce(btrim(v.clinic_name), '')
  );
