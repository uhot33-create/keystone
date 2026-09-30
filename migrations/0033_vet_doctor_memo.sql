create table if not exists vet_doctor_memo (
  user_id    text primary key,
  body       text not null default '',
  updated_at timestamptz not null default now()
);

insert into vet_doctor_memo (user_id, body)
select distinct on (user_id) user_id, btrim(ask_note)
from vet_visits
where ask_note is not null and btrim(ask_note) <> ''
order by user_id, updated_at desc
on conflict (user_id) do nothing;
