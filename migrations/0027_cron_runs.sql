create table if not exists cron_runs (
  id             bigserial primary key,
  job            text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean not null default false,
  smoking_users  integer,
  smoking_error  text,
  calorie_dogs   integer,
  calorie_error  text
);

create index if not exists cron_runs_job_started_idx on cron_runs (job, started_at desc);
