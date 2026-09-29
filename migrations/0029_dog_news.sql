alter table user_settings
  add column if not exists show_dog_news boolean not null default true;

create table if not exists desk_dog_news (
  shown_on   date primary key,
  items      jsonb not null,
  fetched_at timestamptz not null default now()
);
