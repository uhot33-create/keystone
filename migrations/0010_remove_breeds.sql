update memos
set breed_id = null
where breed_id in (
  select id from dog_breeds
  where name in ('ドイツシェパード', 'サモエド', '北海道犬')
);

delete from dog_breeds
where name in ('ドイツシェパード', 'サモエド', '北海道犬');
