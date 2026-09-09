create table if not exists user_dog_facts (
  user_id   text not null,
  fact_key  text not null,
  shown_on  date not null,
  shown_at  timestamptz not null default now(),
  primary key (user_id, fact_key)
);

create index if not exists user_dog_facts_user_shown_at_idx
  on user_dog_facts (user_id, shown_at);
