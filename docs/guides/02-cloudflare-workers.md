# Cloudflare Workers セットアップ

`gh-auth-bridge` を Cloudflare Workers へ作成、deploy、運用する手順。

## 1. API Token

Cloudflare Dashboard > My Profile > API Tokens > Create Token

推奨テンプレート:

- `Edit Cloudflare Workers`

必要な主な権限:

- Account: Workers Scripts (Edit)
- Account: Account Settings (Read)
- Zone: Workers Routes (Edit)

## 2. Wrangler 認証

Browser OAuth が使えない場合は API token を使う。

```bash
export CLOUDFLARE_API_TOKEN=<token>
pnpm exec wrangler whoami
```

## 3. 初回 deploy

```bash
pnpm install
pnpm exec wrangler deploy
```

現行本番 URL:
`https://gh-auth-bridge.koumatsumoto.workers.dev`

## 4. Variables

`wrangler.toml`:

```toml
[vars]
SPA_ORIGIN = "https://koumatsumoto.github.io"
```

`SPA_ORIGIN` は consumer app の Pages origin と一致させる。
ここがずれると `/auth/refresh` が `403 forbidden_origin` になる。

## 5. Secrets

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

## 6. 確認

```bash
curl https://gh-auth-bridge.koumatsumoto.workers.dev/auth/health
```

期待値:

- body が `OK`
- `/auth/login` で GitHub 認可画面へ遷移
- callback 後に popup が閉じて consumer app に `postMessage` が届く
