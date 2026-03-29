# ローカル開発

## 前提

- Node.js >= 24.13.0
- pnpm >= 10.0.0
- GitHub App Client ID / Secret を取得済み

## 1. セットアップ

```bash
pnpm install
cp .dev.vars.example .dev.vars
```

`.dev.vars`:

```ini
GITHUB_CLIENT_ID=<Client ID>
GITHUB_CLIENT_SECRET=<Client Secret>
SPA_ORIGIN=http://localhost:5173
```

## 2. 起動

```bash
pnpm dev
```

Wrangler の開発 URL は通常 `http://localhost:8787`。

## 3. Consumer app 側

`ato` または `zai` 側で:

```env
VITE_OAUTH_PROXY_URL=http://localhost:8787
```

## 4. 動作確認

- `/auth/health` が `OK`
- popup login が GitHub 認可へ遷移
- callback 後に `gh-auth-bridge:auth:success` が届く
- refresh token がある場合に `/auth/refresh` が成功する
