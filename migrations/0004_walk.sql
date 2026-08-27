create table if not exists dog_breeds (
  id          text primary key,
  name        text not null unique,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists memos (
  id                 text primary key,
  user_id            text not null,
  name               text not null,
  breed_id           text references dog_breeds(id),
  sex                text,
  birthday           date,
  age_years          integer,
  note               text,
  last_met_on        date,
  rainbow_bridge     boolean not null default false,
  rainbow_bridge_on  date,
  image_url          text,
  image_pathname     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists memos_user_id_idx on memos (user_id);
create index if not exists memos_user_name_idx on memos (user_id, name);

insert into dog_breeds (id, name, sort_order) values
  ('a1000000-0000-4000-8000-000000000001', 'チワワ', 10),
  ('a1000000-0000-4000-8000-000000000002', 'トイプードル', 20),
  ('a1000000-0000-4000-8000-000000000003', 'ポメラニアン', 30),
  ('a1000000-0000-4000-8000-000000000004', 'ミニチュアダックスフンド', 40),
  ('a1000000-0000-4000-8000-000000000005', 'シー・ズー', 50),
  ('a1000000-0000-4000-8000-000000000006', 'ヨークシャーテリア', 60),
  ('a1000000-0000-4000-8000-000000000007', 'マルチーズ', 70),
  ('a1000000-0000-4000-8000-000000000008', 'パピヨン', 80),
  ('a1000000-0000-4000-8000-000000000009', 'ペキニーズ', 90),
  ('a1000000-0000-4000-8000-000000000010', 'フレンチブルドッグ', 100),
  ('a1000000-0000-4000-8000-000000000011', 'パグ', 110),
  ('a1000000-0000-4000-8000-000000000012', 'ボストンテリア', 120),
  ('a1000000-0000-4000-8000-000000000013', 'キャバリア', 130),
  ('a1000000-0000-4000-8000-000000000014', 'ビーグル', 140),
  ('a1000000-0000-4000-8000-000000000015', '柴犬', 150),
  ('a1000000-0000-4000-8000-000000000016', '秋田犬', 160),
  ('a1000000-0000-4000-8000-000000000017', '北海道犬', 170),
  ('a1000000-0000-4000-8000-000000000018', 'コーギー', 180),
  ('a1000000-0000-4000-8000-000000000019', 'ボーダーコリー', 190),
  ('a1000000-0000-4000-8000-000000000020', 'ゴールデンレトリバー', 200),
  ('a1000000-0000-4000-8000-000000000021', 'ラブラドールレトリバー', 210),
  ('a1000000-0000-4000-8000-000000000022', 'ドイツシェパード', 220),
  ('a1000000-0000-4000-8000-000000000023', 'シベリアンハスキー', 230),
  ('a1000000-0000-4000-8000-000000000024', 'サモエド', 240),
  ('a1000000-0000-4000-8000-000000000025', 'ミックス', 900),
  ('a1000000-0000-4000-8000-000000000026', 'その他', 910)
on conflict (name) do nothing;
