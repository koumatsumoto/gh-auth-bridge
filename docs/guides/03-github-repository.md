# GitHub リポジトリ設定

`gh-auth-bridge` repo の GitHub Actions と deploy に必要な設定。

## 1. Repository Secret

Settings > Secrets and variables > Actions > Secrets

| Name | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers deploy |

## 2. Workflow

- `CI`
  - format check
  - markdownlint
  - eslint
  - typecheck
  - tests
- `Deploy`
  - `CI` 成功後に `wrangler deploy`

## 3. 初回確認

1. `main` に push
2. `CI` が success
3. `Deploy` が success
4. `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/health` が `OK`

## 4. 依存関係

Consumer repo で更新が必要なもの:

- `ato` Actions Variable `OAUTH_PROXY_URL`
- `zai` Actions Variable `OAUTH_PROXY_URL`
- GitHub App callback URL
