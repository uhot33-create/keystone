alter table dogs add column if not exists portrait_id text not null default 'chihuahua-smooth-wr';
alter table user_settings add column if not exists person_portrait text not null default 'woman';
