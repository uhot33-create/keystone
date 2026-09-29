alter table cron_runs
  add column if not exists log text not null default '';
