# GitHub リポジトリ設定

`gh-auth-bridge` repo の GitHub Actions と deploy に必要な設定。

## 1. Repository Secret

Settings > Secrets and variables > Actions > Secrets

| Name                   | 用途                      |
| ---------------------- | ------------------------- |
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

`ato` と `zai` の `OAUTH_PROXY_URL` には次の値を設定する。

```text
https://gh-auth-bridge.koumatsumoto.workers.dev
```

注意点:

- `/auth/login` などの path は付けない
- 末尾の `/` も付けない
- GitHub App callback URL は
  `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/callback`
