# gh-auth-bridge

Cloudflare Workers 上で動作する GitHub OAuth bridge。
`ato` と `zai` から共有利用され、GitHub OAuth callback と
refresh token の境界だけを担当する。

## Endpoints

| Method | Path             | Purpose                                           |
| ------ | ---------------- | ------------------------------------------------- |
| `GET`  | `/auth/login`    | GitHub OAuth 開始                                 |
| `GET`  | `/auth/callback` | popup token bridge or standalone install guidance |
| `POST` | `/auth/refresh`  | refresh token 交換                                |
| `GET`  | `/auth/health`   | health check                                      |

## Message and Storage Contract

- Success message: `gh-auth-bridge:auth:success`
- Error message: `gh-auth-bridge:auth:error`
- Shared auth keys consumed by clients:
  - `gh-auth-bridge:token`
  - `gh-auth-bridge:refresh-token`
  - `gh-auth-bridge:token-expires-at`
  - `gh-auth-bridge:refresh-expires-at`

## Client SDK

SPA 向けクライアント SDK を `@koumatsumoto/gh-auth-bridge-client` として
GitHub Packages に公開している。

```bash
pnpm add @koumatsumoto/gh-auth-bridge-client
```

popup login、token 管理、GitHub API 呼び出し（自動 refresh 付き）を提供する。
React + TanStack Query 向けの統合も `@koumatsumoto/gh-auth-bridge-client/react` で利用可能。

詳細は [`client/README.md`](./client/README.md) を参照。

## Prerequisites

- Node.js >= 24.13.0
- pnpm >= 10.0.0
- Cloudflare account with Workers access
- GitHub App with OAuth during installation enabled

## Local Development

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

`.dev.vars`:

```ini
GITHUB_CLIENT_ID=<GitHub App Client ID>
GITHUB_CLIENT_SECRET=<GitHub App Client Secret>
SPA_ORIGIN=http://localhost:5173
```

開発 callback URL は `http://localhost:8787/auth/callback`。

## Cloudflare Project Setup

### 1. Create the Worker project

```bash
pnpm install
pnpm deploy
```

初回 deploy で `gh-auth-bridge` Worker を Cloudflare 上に作成する。
必要なら非対話実行用に `CLOUDFLARE_API_TOKEN` を export する。

```bash
export CLOUDFLARE_API_TOKEN=<token>
pnpm deploy
```

### 2. Configure runtime variables

`wrangler.toml` の `SPA_ORIGIN` は Pages origin と一致させる。

```toml
[vars]
SPA_ORIGIN = "https://koumatsumoto.github.io"
```

### 3. Configure Worker secrets

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

### 4. Verify

- `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/health` が `OK`
- `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/login` で GitHub 認可画面に遷移
- popup login callback では popup が閉じ、SPA 側に `gh-auth-bridge:auth:success` が届く
- GitHub App install callback では standalone の completion / retry page が表示される

## GitHub Actions Setup

Repository settings で以下を設定する。

- Secret: `CLOUDFLARE_API_TOKEN`

Workflow:

- `CI`: format, markdownlint, eslint, typecheck, tests
- `Deploy`: `CI` 成功後に `wrangler deploy`

## GitHub App Setup

`ato` で使っていた GitHub App をそのまま流用する場合は、
少なくとも callback URL をこの Worker に更新する。

### Required App settings

- Development homepage URL:
  `http://localhost:5173`
- Development callback URL:
  `http://localhost:8787/auth/callback`
- Production homepage URL:
  `https://koumatsumoto.github.io/ato`
- Production callback URL:
  `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/callback`

### Permissions

- Repository permissions: `Issues` = Read and write
- Metadata = Read-only
- `Request user authorization (OAuth) during installation` = enabled

### Installation targets

- `ato-datastore`
- `zai-datastore`

Production callback URL:
`https://gh-auth-bridge.koumatsumoto.workers.dev/auth/callback`

`ato` 側のセットアップ導線が固定 install URL を持っている場合は、
その URL も新 App 名に合わせて更新する。

## Security Review Checklist

- `GITHUB_CLIENT_SECRET` を repo に保存しない
- `SPA_ORIGIN` と本番 Pages origin を一致させる
- GitHub App callback URL を Worker `/auth/callback` に向ける
- `postMessage` は `targetOrigin` 固定、SPA 側は `event.origin` 検証を維持する
- refresh endpoint の `Origin` 検証が通らないアクセスは 403 にする
- popup HTML が token 値や origin 値で script break しないことをテストで確認する

## Commands

```bash
pnpm dev
pnpm lint
pnpm lint:md
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm deploy
```

## Documentation

- `docs/guides/01-github-app.md`
- `docs/guides/02-cloudflare-workers.md`
- `docs/guides/03-github-repository.md`
- `docs/guides/04-local-development.md`
- `docs/guides/05-client-sdk.md`
- `docs/specs/01-architecture.md`
- `docs/specs/02-worker-contract.md`
- `docs/specs/03-auth-flow.md`
- `docs/specs/04-security.md`
- `docs/specs/05-ci-cd.md`
- `docs/specs/06-client-sdk.md`
