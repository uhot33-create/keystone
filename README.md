# 暮らし帳

メールアドレスでログインし、日々の記録を整えるアプリです。

- **わんカロリー** — 愛犬の1日のカロリー記録と、理想体重に向けた必要カロリー
- **喫煙管理** — 24時間の上限本数と減算、前回吸った日時

Vercel + Neon（Postgres）で動作します。

## 環境変数（Vercel）

`.env` ファイルは使いません。Vercel の Project Settings → Environment Variables に設定してください。

| 名前 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon の接続文字列 |
| `BETTER_AUTH_SECRET` | セッション署名用シークレット（32文字以上） |
| `BETTER_AUTH_URL` | 公開 URL（例: `https://keystone.vercel.app`） |
| `VITE_AUTH_ENABLED` | `true` |

## ローカル

```bash
npm install
npm run dev
```

`DATABASE_URL` が無いときは埋め込みの Postgres（PGLite）を使います。再起動でデータは消えます。
