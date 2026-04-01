# @koumatsumoto/gh-auth-bridge-client

gh-auth-bridge Worker と連携する SPA 向けクライアント SDK。
GitHub OAuth の popup login、token refresh、GitHub API 呼び出しを共通化する。

## インストール

### 1. `.npmrc` の設定

プロジェクトルートに `.npmrc` を作成:

```ini
@koumatsumoto:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

ローカル開発では `read:packages` スコープの Personal Access Token (classic) が必要:

```bash
# 方法 A: 環境変数
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# 方法 B: npm login
npm login --scope=@koumatsumoto --auth-type=legacy --registry=https://npm.pkg.github.com
```

### 2. パッケージ追加

```bash
pnpm add @koumatsumoto/gh-auth-bridge-client
```

## Quick Start

### Core（フレームワーク非依存）

```typescript
import { configure, openLoginPopup, githubFetch } from "@koumatsumoto/gh-auth-bridge-client";

// アプリ起動時に1回呼ぶ
configure({ proxyUrl: "https://gh-auth-bridge.example.workers.dev" });

// popup login
const tokenSet = await openLoginPopup("https://gh-auth-bridge.example.workers.dev");

// GitHub API 呼び出し（自動 token refresh 付き）
const response = await githubFetch("/user");
```

### React + TanStack Query

```typescript
import {
  configure,
  setupTokenRefresh,
  createAuthQueryClient,
  AuthProvider,
  useAuth,
} from "@koumatsumoto/gh-auth-bridge-client/react";
import { QueryClientProvider } from "@tanstack/react-query";

// アプリ起動時
configure({ proxyUrl: import.meta.env["VITE_OAUTH_PROXY_URL"] as string });
setupTokenRefresh();
const queryClient = createAuthQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MyApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function MyApp() {
  const { state, login, logout } = useAuth();

  if (!state.token) return <button onClick={login}>Login with GitHub</button>;
  return <p>Hello, {state.user?.login}! <button onClick={logout}>Logout</button></p>;
}
```

## API リファレンス

### Configuration

| Export                    | 説明                                           |
| ------------------------- | ---------------------------------------------- |
| `configure({ proxyUrl })` | SDK を初期化。全 API 呼び出しの前に1回実行する |
| `getProxyUrl()`           | 設定済みの proxyUrl を返す                     |

### Auth Client

- `openLoginPopup(proxyUrl)`
  — popup で GitHub OAuth を開始し、`TokenSet` を返す
- `refreshAccessToken(proxyUrl, refreshToken)`
  — refresh token で新しい `TokenSet` を取得
- `LOGIN_TIMEOUT_MS`
  — popup login のタイムアウト (120秒)

### Token Store

| Export                  | 説明                                              |
| ----------------------- | ------------------------------------------------- |
| `getToken()`            | localStorage から access token を取得             |
| `setToken(token)`       | access token を保存                               |
| `setTokenSet(tokenSet)` | token 一式を保存し `TOKEN_REFRESHED_EVENT` を発火 |
| `getRefreshToken()`     | refresh token を取得                              |
| `clearToken()`          | 全 auth キーを削除し `TOKEN_CLEARED_EVENT` を発火 |
| `clearAccessToken()`    | access token のみ削除（refresh token は保持）     |
| `isAuthenticated()`     | token が存在するか                                |
| `TOKEN_CLEARED_EVENT`   | token 削除時のイベント名                          |
| `TOKEN_REFRESHED_EVENT` | token 更新時のイベント名                          |

### GitHub Client

- `githubFetch(path, options?)`
  — GitHub API に認証付きリクエスト。401 時に自動 refresh
- `throwIfNotOk(response)`
  — response.ok でなければ `GitHubApiError` を throw

### Token Refresh

- `registerTokenRefresh(fn)`
  — refresh 関数を登録（`setupTokenRefresh()` 経由）
- `getTokenRefreshFn()`
  — 登録済み refresh 関数を取得
- `setupTokenRefresh()`
  — (React export) tryRefresh を自動登録

### Errors

- `AuthError` — 認証失敗
- `TokenRefreshError`
  — token refresh 失敗
  (`.reason`: `"invalid_grant"` or `"transient"`)
- `GitHubApiError`
  — GitHub API エラー (`.status`, `.body`)
- `NetworkError` — ネットワーク接続失敗
- `RateLimitError` — レート制限 (`.resetAt`)

### Rate Limit

| Export                      | 説明                        |
| --------------------------- | --------------------------- |
| `isRateLimited(response)`   | response がレート制限か判定 |
| `extractRateLimit(headers)` | `RateLimitInfo` を抽出      |

### Storage Keys

| Export                   | 値                                    |
| ------------------------ | ------------------------------------- |
| `TOKEN_KEY`              | `"gh-auth-bridge:token"`              |
| `REFRESH_TOKEN_KEY`      | `"gh-auth-bridge:refresh-token"`      |
| `EXPIRES_AT_KEY`         | `"gh-auth-bridge:token-expires-at"`   |
| `REFRESH_EXPIRES_AT_KEY` | `"gh-auth-bridge:refresh-expires-at"` |

### Auth Log

| Export                    | 説明                                       |
| ------------------------- | ------------------------------------------ |
| `authLog(event, detail?)` | 診断ログに記録（最大50件のリングバッファ） |
| `getAuthLog()`            | ログエントリのコピーを返す                 |
| `clearAuthLog()`          | ログをクリア                               |

## エントリポイント

- `@koumatsumoto/gh-auth-bridge-client`
  — Core API / Peer deps: なし
- `@koumatsumoto/gh-auth-bridge-client/react`
  — Core + React bindings
  / Peer deps: `react ^19`, `@tanstack/react-query ^5`

## アプリ固有キーのクリーンアップ

SDK の `clearToken()` は `gh-auth-bridge:*` キーのみ削除する。
アプリ固有の localStorage キー（例: `ato:user`, `zai:repo-initialized`）は
`TOKEN_CLEARED_EVENT` を listen して削除する:

```typescript
import { TOKEN_CLEARED_EVENT } from "@koumatsumoto/gh-auth-bridge-client";

window.addEventListener(TOKEN_CLEARED_EVENT, () => {
  localStorage.removeItem("myapp:user");
  localStorage.removeItem("myapp:cache");
});
```

## エラーハンドリング

### TanStack Query との統合

`createAuthQueryClient()` は以下のエラーハンドリングを組み込み済み:

- `TokenRefreshError` (transient): access token のみクリア（refresh token 保持）
- `TokenRefreshError` (invalid_grant): 全 token クリア（再ログイン必要）
- `AuthError`: 全 token クリア
- `GitHubApiError` (403/404/422): リトライしない
- その他: 2回までリトライ（指数バックオフ）

### 手動ハンドリング

```typescript
import { githubFetch, throwIfNotOk, GitHubApiError } from "@koumatsumoto/gh-auth-bridge-client";

const response = await githubFetch("/repos/owner/repo/issues");
await throwIfNotOk(response);
const issues = await response.json();
```

## GitHub Actions での認証設定

### パッケージ install（消費側リポジトリ）

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/setup-node@v5
    with:
      node-version: "24"
      registry-url: "https://npm.pkg.github.com"
      scope: "@koumatsumoto"

  - run: pnpm install --frozen-lockfile
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**前提**: gh-auth-bridge の Package settings → "Manage Actions access" で
消費側リポジトリに Read アクセスを付与する必要がある。

### パッケージ publish（gh-auth-bridge リポジトリ）

`client/v*` タグの push で自動 publish:

```bash
# バージョン更新
cd client && npm version patch

# タグ付きプッシュ
git add client/package.json
git commit -m "chore(client): release v0.1.1"
git tag client/v0.1.1
git push origin main --tags
```

## Worker との契約

このクライアント SDK は以下のメッセージプロトコルに依存する:

**postMessage (popup → SPA)**:

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

**POST /auth/refresh レスポンス**:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 28800,
  "refreshTokenExpiresIn": 15811200
}
```

Worker 実装詳細は
[gh-auth-bridge リポジトリ](https://github.com/koumatsumoto/gh-auth-bridge)
を参照。
