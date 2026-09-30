# 暮らし帳

メールアドレスでログインして使う、個人用の記録アプリです。

## 概要

ログイン後のメニューから、次を使います。

- **わんカロリー** — 愛犬の食事カロリー、体重、目安カロリー、推移グラフ
- **喫煙管理** — 1日の上限本数、減算、毎日0時（日本時間）のリセット、達成バッチ
- **お散歩メモ** — 出会った子のカード（犬種・画像・虹渡り）と、GPX の散歩ログ
- **通院履歴** — 通院の予定と記録、次回に先生へ伝えるメモ
- **カップ麺** — 品名と在庫数

メニュー下部には、今日は何の日、格言、小話、犬の豆知識、占い、犬の話題を出せます。表示のオンオフはアカウントごとに保存します。

## サーバー実行環境

- アプリ: [Vercel](https://vercel.com)（Nitro の `vercel` プリセット。Hobby 想定）
- データベース: Supabase の Postgres。接続は `DATABASE_URL`（プールは transaction mode の 6543）
- 画像: Vercel Blob。データベースには URL だけを保存する
- 毎日 0:00（日本時間）の定期実行: Vercel Cron。定義は `vite.config.ts` の Nitro 設定（`0 15 * * *` UTC）
- `DATABASE_URL` が無いローカル起動だけ、埋め込みの Postgres（PGLite）を使う。再起動でデータは消える

## 環境変数

`.env` ファイルは使いません。Vercel の Project Settings → Environment Variables に設定します。

| 名前 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 本番は必須 | Supabase の接続文字列 |
| `BETTER_AUTH_SECRET` | 必須 | セッション署名用。32文字以上 |
| `BETTER_AUTH_URL` | 必須 | 公開 URL。末尾スラッシュなし |
| `VITE_AUTH_ENABLED` | 必須 | `true` |
| `BLOB_READ_WRITE_TOKEN` | 画像を使うとき | Vercel Blob の読み書きトークン |
| `RESEND_API_KEY` | 再設定メール | Resend の API キー |
| `RESET_EMAIL_FROM` | 任意 | 再設定メールの差出人。未設定時は Resend の試験用差出人 |
| `CRON_SECRET` | 本番の Cron では必要 | 16文字以上のランダム文字列。Vercel Cron が `Authorization: Bearer` で送る |

## 使用言語

- TypeScript
- SQL（Postgres。`migrations/*.sql`）
- HTML / CSS（画面は React）

## 使用ライブラリ

- React 19
- TanStack Start / TanStack Router（画面とサーバー処理）
- Vite / Nitro（開発と Vercel 向けビルド）
- Tailwind CSS
- better-auth（メールアドレスのログイン）
- pg（Postgres 接続）
- Zod（入力チェック）
- @vercel/blob（画像保存）
- sharp（一覧用サムネイル）
- Leaflet（散歩ログの軌跡）
- Lucide（アイコン）

## 運用

### インストール方法

```bash
npm install
npm run dev
```

開発サーバーは `http://localhost:8080` です。本番は GitHub の `main` を Vercel がビルドします。`npm run build` のあと `migrations/*.sql` が未適用分だけ実行されます。

### パスワード再設定

1. ログイン画面の「パスワードを忘れた」からメールアドレスを送る
2. 届いたリンク（1時間有効）で新しいパスワードを設定する
3. ログイン中は右上の丸から「パスワードの再設定」でも変更できる

送信には `RESEND_API_KEY` が必要です。未設定だと再設定メールは送れません。

### 散歩ログのインポート

お散歩メモの「散歩ログ」で、GPS アプリが書き出した `.gpx` を選びます。距離、時間、地図の軌跡を保存します。

iPhone の Geographica などは「書き出し → GPX → ファイルに保存」したあと、取り込み画面の「ブラウズ」から選びます。ファイルは 8MB 以下です。

### カロリー集計バッチ

毎日 0:00（日本時間）に `/api/cron/calorie-summary` が動きます。

- 週・月・年のカロリー合計と、期間最終日の体重をデータベースに保存する
- 喫煙管理の残数を、その日の上限に戻す（前回リセット日が今日より前のユーザーだけ）

スケジュールは `vite.config.ts` だけに書きます。`vercel.json` にも書くとデプロイが重複エラーになります。`CRON_SECRET` が無いと、Cron からの呼び出しは 401 になります。実行結果は `cron_runs` に残します。
