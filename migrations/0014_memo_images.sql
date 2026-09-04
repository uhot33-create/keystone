alter table memos
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists cover_index integer not null default 0;

update memos
set
  images = jsonb_build_array(
    jsonb_build_object('url', image_url, 'pathname', coalesce(image_pathname, image_url))
  ),
  cover_index = 0
where image_url is not null
  and (images = '[]'::jsonb or jsonb_array_length(images) = 0);
