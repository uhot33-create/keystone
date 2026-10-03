update vet_visits as plan
set next_visit_status = source.next_visit_status
from vet_visits as source
where plan.status = 'planned'
  and plan.next_visit_status is null
  and source.user_id = plan.user_id
  and source.status = 'done'
  and source.next_visit_on = plan.visit_on
  and coalesce(btrim(source.clinic_name), '') = coalesce(btrim(plan.clinic_name), '')
  and source.next_visit_status in ('need', 'booked');
