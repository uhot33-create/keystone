-- ドイツシェパード・サモエド・北海道犬を犬種マスタから削除します。
-- これらの種類が付いているカードは、種類だけ未選択になります（カード自体は残ります）。

update memos
set breed_id = null
where breed_id in (
  select id from dog_breeds
  where name in ('ドイツシェパード', 'サモエド', '北海道犬')
);

delete from dog_breeds
where name in ('ドイツシェパード', 'サモエド', '北海道犬');

select name, sort_order
from dog_breeds
order by sort_order, name;
