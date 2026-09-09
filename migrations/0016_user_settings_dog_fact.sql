alter table user_settings
  add column if not exists show_dog_fact boolean not null default true;
