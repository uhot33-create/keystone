create table if not exists user_settings (
  user_id          text primary key,
  show_on_this_day boolean not null default true,
  show_quote       boolean not null default true,
  show_story       boolean not null default true,
  show_fortune     boolean not null default true,
  updated_at       timestamptz not null default now()
);
