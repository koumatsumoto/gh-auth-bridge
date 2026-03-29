# GitHub App 設定ガイド

`gh-auth-bridge` は GitHub App の OAuth callback と refresh token 交換を仲介する。
このガイドでは bridge 用の GitHub App 設定をまとめる。

## 1. GitHub App を作成

GitHub > Settings > Developer settings > GitHub Apps > New GitHub App

## 2. 必須設定

- 開発用 App name: `gh-auth-bridge (dev)`
- 本番 App name: `gh-auth-bridge`
- 開発 Homepage URL:
  `http://localhost:5173`
- 本番 Homepage URL:
  `https://koumatsumoto.github.io/ato`
- 開発 Callback URL:
  `http://localhost:8787/auth/callback`
- 本番 Callback URL:
  `https://gh-auth-bridge.koumatsumoto.workers.dev/auth/callback`

本番 Homepage URL は bridge 自体の URL ではなく、
実際の利用導線に合わせた consumer app を指定する。

## 3. 権限

- Repository permissions: `Issues` = Read and write
- Metadata = Read-only

## 4. OAuth 設定

- `Request user authorization (OAuth) during installation` を有効化する

この設定が無効だと、browser popup から OAuth 認可フローを完了できない。

## 5. Client ID / Client Secret

作成後の画面で以下を控える。

- Client ID
- Client Secret

これらは Cloudflare Workers secret として保存し、リポジトリには入れない。

## 6. インストール対象

少なくとも次の private repository へ install する。

- `ato-datastore`
- `zai-datastore`

## 7. Consumer 側への反映

- `ato` の setup 導線が App slug を固定している場合は install URL を更新する
- `ato` / `zai` の `OAUTH_PROXY_URL` は bridge Worker URL を指すように設定する
