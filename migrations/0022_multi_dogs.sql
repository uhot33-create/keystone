drop index if exists dogs_user_id_uq;
create index if not exists dogs_user_id_idx on dogs (user_id, id);
