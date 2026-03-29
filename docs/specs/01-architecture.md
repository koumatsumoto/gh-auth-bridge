# 01. Architecture

`gh-auth-bridge` は SPA と GitHub OAuth の境界を担う Cloudflare Worker。

## 役割

- OAuth login 開始
- callback で code を token に交換
- popup `postMessage` で consumer app に結果を返す
- refresh token を使った access token 再取得

## 非役割

- user/session の永続化
- GitHub API の代理実行
- repo ごとの business logic

## 利用者

- `ato`
- `zai`

両者は同じ auth contract を共有し、token を `gh-auth-bridge:*` key に保存する。
