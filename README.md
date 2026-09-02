# 暮らし帳

メールアドレスでログインし、日々の記録を整えるアプリです。

- **わんカロリー** — 愛犬の1日のカロリー記録と、理想体重に向けた必要カロリー
- **喫煙管理** — 1日の上限本数と減算、毎日0時にリセット、前回吸った日時
- **お散歩メモ** — 出会った子のカード（種類・画像・虹渡り）と、GPX の散歩ログと、Strava の散歩ログ

Vercel + Neon（Postgres）で動作します。お散歩メモの画像は Vercel Blob に保存します（Neon には URL のみ）。Hobby / Neon Free を想定しています。メニュー下部の「今日は何の日」「今日の格言」「今日の占い」は、Wikipedia・祝日API・名言API・朝日新聞デジタルなど公開Webからその日の内容を取得します。


## 最初に実行するコマンド

```bash
npm install
npm run dev
```

`DATABASE_URL` が無いときは埋め込みの Postgres（PGLite）を使います。再起動でデータは消えます。

## 環境変数（Vercel）

`.env` ファイルは使いません。Vercel の Project Settings → Environment Variables に設定してください。

| 名前 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon の接続文字列 |
| `BETTER_AUTH_SECRET` | セッション署名用シークレット（32文字以上） |
| `BETTER_AUTH_URL` | 公開 URL（末尾スラッシュなし） |
| `VITE_AUTH_ENABLED` | `true` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob の読み書きトークン（お散歩メモの画像用） |

## Neon

1. Neon でプロジェクトを作り、接続文字列を `DATABASE_URL` にする
2. デプロイ時の `npm run build` が `migrations/*.sql` を適用する
3. 犬種マスタは `migrations/0004_walk.sql` で投入される。追加する場合は `scripts/seed-breeds.sql` を Neon SQL Editor で実行する

テーブルは `dog_breeds`（犬種マスタ）と `memos`（カード）。カードはログインユーザーごとに分かれます。

## Vercel Blob

1. Vercel の Storage で Blob ストアを作る
2. `BLOB_READ_WRITE_TOKEN` を Production / Preview に設定する
3. 画像はアプリの API 経由で Vercel Blob に保存します（Neon には URL のみ）。iPhone の HEIC は JPEG にします。Vercel の上限のため、大きい写真は自動で縮小します

未設定でもカードの文字情報は保存できます。画像だけ保存できません。

## 散歩ログ（GPX）

お散歩メモ → 散歩ログ から、GPS アプリが書き出した `.gpx` を取り込みます。距離・時間・地図の軌跡を保存します。無料アプリなら Open GPX Tracker などが使えます。

## ディレクトリ（お散歩メモ）

```
src/routes/walk*.tsx          一覧・追加・編集
src/routes/api/blob/upload.ts Blob クライアントアップロード
src/lib/walk/                 API・年齢・画像・フィルタ
src/components/walk/          カード・フォーム・ツールバー
migrations/0004_walk.sql      テーブルと犬種初期データ
scripts/seed-breeds.sql       犬種の再投入用
```
