# 05. CI/CD

## CI

`pull_request` / `push main` で以下を実行する。

- `pnpm format:check`
- `pnpm lint:md`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:coverage`

## Deploy

`CI` 成功後に `cloudflare/wrangler-action` で deploy する。

必要な secret:

- `CLOUDFLARE_API_TOKEN`

## Rollout checklist

1. Worker deploy
2. Worker secrets 設定
3. GitHub App callback URL 更新
4. `ato` / `zai` の `OAUTH_PROXY_URL` 更新
5. `ato` / `zai` の login / refresh を実機確認
