create table if not exists vet_visits (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  visit_on       date not null,
  clinic_name    text,
  kind           text not null default 'その他',
  title          text not null,
  diagnosis      text,
  treatment      text,
  next_visit_on  date,
  cost_yen       integer,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists vet_visits_user_date_idx on vet_visits (user_id, visit_on desc);
