# 06. Client SDK 設計仕様

## 概要

`@koumatsumoto/gh-auth-bridge-client` は gh-auth-bridge Worker のクライアント SDK。
SPA からの GitHub OAuth popup login、token 管理、GitHub API 呼び出しを共通化する。

## パッケージ構成

```text
client/
├── src/
│   ├── index.ts          # Core barrel export（フレームワーク非依存）
│   ├── react.ts          # React barrel export（Core + React bindings）
│   ├── config.ts         # configure() / getProxyUrl()
│   ├── types.ts          # TokenSet, OAuthMessage, AuthUser 等
│   ├── errors.ts         # AuthError, TokenRefreshError 等
│   ├── auth-client.ts    # openLoginPopup(), refreshAccessToken()
│   ├── token-store.ts    # localStorage token 管理 + events
│   ├── token-refresh.ts  # refresh 関数の登録機構
│   ├── github-client.ts  # githubFetch() with auto-refresh
│   ├── rate-limit.ts     # GitHub API rate limit 判定
│   ├── storage-keys.ts   # localStorage キー定数
│   ├── auth-log.ts       # 診断用リングバッファログ
│   └── react/
│       ├── use-auth.tsx   # AuthProvider + useAuth hook
│       ├── query-client.ts # createAuthQueryCache/Client
│       └── setup.ts      # setupTokenRefresh()
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
└── vitest.config.ts
```

## エントリポイント

- `@koumatsumoto/gh-auth-bridge-client`
  — Core API / Peer deps: なし
- `@koumatsumoto/gh-auth-bridge-client/react`
  — React 統合
  / Peer deps: react ^19, @tanstack/react-query ^5

## Worker ↔ Client プロトコル

### popup login

1. Client が `{proxyUrl}/auth/login` を popup で開く
2. Worker が GitHub OAuth へリダイレクト
3. 認可完了後、Worker が `window.opener.postMessage()` で結果を送信
4. Client が `message` イベントで受信し、origin を検証

**メッセージ型**:

```typescript
// 成功
{
  type: "gh-auth-bridge:auth:success",
  accessToken,
  refreshToken?,
  expiresIn?,
  refreshTokenExpiresIn?
}
// エラー
{ type: "gh-auth-bridge:auth:error", error }
```

### token refresh

1. Client が `POST {proxyUrl}/auth/refresh` に `{ refreshToken }` を送信
2. Worker が GitHub API で token 交換
3. Worker が新 token セットを JSON で返却

### 共有 localStorage キー

| キー                                | 用途                               |
| ----------------------------------- | ---------------------------------- |
| `gh-auth-bridge:token`              | access token                       |
| `gh-auth-bridge:refresh-token`      | refresh token                      |
| `gh-auth-bridge:token-expires-at`   | access token 有効期限 (timestamp)  |
| `gh-auth-bridge:refresh-expires-at` | refresh token 有効期限 (timestamp) |

## 設定・初期化フロー

```text
configure({ proxyUrl })  →  setupTokenRefresh()  →  React render
       ↓                          ↓
  module state に保存       registerTokenRefresh(tryRefresh) を呼ぶ
                                  ↓
                          githubFetch() の 401 時に tryRefresh が呼ばれる
```

`configure()` はアプリのエントリポイントで1回だけ呼ぶ。
`setupTokenRefresh()` は React 統合で使用（Core のみの場合は手動で `registerTokenRefresh()` を呼ぶ）。

## React bindings の設計意図

### AuthProvider

- `useQuery` で `/user` を取得し `AuthState` を提供
- `TOKEN_CLEARED_EVENT` / `TOKEN_REFRESHED_EVENT` を listen して React state を同期
- `login()` は popup を開き、成功時に token を保存 + user query を invalidate
- `logout()` は `clearToken()` を呼ぶだけ（イベント経由で state 更新）

### createAuthQueryClient

- `QueryCache.onError` で `TokenRefreshError` / `AuthError` を捕捉
- transient エラー: access token のみクリア（refresh token で再試行可能）
- invalid_grant / AuthError: 全 token クリア（再ログイン必要）
- retry: AuthError は即失敗、403/404/422 は即失敗、その他は2回まで

### アプリ固有キーの分離

SDK は `gh-auth-bridge:*` キーのみ管理。
アプリ固有キー（`ato:user`, `zai:repo-initialized` 等）は
`TOKEN_CLEARED_EVENT` listener でアプリ側が削除する。

## ビルド

- **JS**: tsup (esbuild) → ESM, target es2024
- **DTS**: tsc (tsconfig.build.json) → `dist/*.d.ts`
- TypeScript 6 の `baseUrl` deprecated 対応のため、tsup の dts 機能は使わず tsc で別途生成

## CI/CD

- CI: `worker-checks` + `client-checks` の2ジョブ並列実行
- publish: `client/v*` タグ push で npmjs.org に自動 publish
- `NPM_TOKEN` secret で認証、provenance 付き
