-- 人のチェックリスト。雛形と、今使っているリスト。履歴は持たない。
create table if not exists check_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists check_templates_user_idx on check_templates (user_id, sort_order, created_at);

create table if not exists check_template_items (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references check_templates (id) on delete cascade,
  user_id      text not null,
  label        text not null,
  sort_order   integer not null default 0
);
create index if not exists check_template_items_template_idx on check_template_items (template_id, sort_order);

create table if not exists check_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists check_lists_user_idx on check_lists (user_id, created_at desc);

create table if not exists check_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references check_lists (id) on delete cascade,
  user_id     text not null,
  label       text not null,
  checked     boolean not null default false,
  sort_order  integer not null default 0
);
create index if not exists check_items_list_idx on check_items (list_id, sort_order);
