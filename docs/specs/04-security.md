# 04. Security

公開リポジトリ前提で、秘密情報は repo に置かず、bridge は fail-closed を維持する。

## Controls

- OAuth `state` を HttpOnly cookie で保持する
- callback で `state` 不一致を拒否する
- `/auth/refresh` は `Origin === SPA_ORIGIN` を必須にする
- popup `postMessage` は `targetOrigin` を固定する
- HTML 応答で script break しないよう token と origin を escape する
- `GITHUB_CLIENT_SECRET` は Cloudflare secret にのみ保存する

## Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- popup HTML:
  - `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'`

## Test focus

- missing `code` / `state`
- invalid cookie state
- invalid `Origin`
- script-breaking token value
- malformed `SPA_ORIGIN`
- upstream token exchange failure
