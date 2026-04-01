# 05. Client SDK セットアップガイド

新規プロジェクトで `@koumatsumoto/gh-auth-bridge-client` を導入する手順。

## 前提条件

- gh-auth-bridge Worker がデプロイ済み
- GitHub App が設定済み（[01-github-app.md](./01-github-app.md) 参照）
- Node.js >= 24, pnpm >= 10

## 1. GitHub Packages 認証設定

### ローカル開発

`read:packages` スコープの Personal Access Token (classic) を作成:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token → `read:packages` にチェック
3. 生成されたトークンを環境変数に設定:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### プロジェクトの `.npmrc` 作成

```ini
@koumatsumoto:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## 2. パッケージインストール

```bash
pnpm add @koumatsumoto/gh-auth-bridge-client
```

## 3. アプリへの組み込み

### React + TanStack Query の場合

```typescript
// src/app/providers.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import {
  configure,
  setupTokenRefresh,
  createAuthQueryClient,
  AuthProvider,
  TOKEN_CLEARED_EVENT,
} from "@koumatsumoto/gh-auth-bridge-client/react";

// 初期化（モジュールスコープで1回）
configure({ proxyUrl: import.meta.env["VITE_OAUTH_PROXY_URL"] as string });
setupTokenRefresh();
const queryClient = createAuthQueryClient();

// アプリ固有キーのクリーンアップ
window.addEventListener(TOKEN_CLEARED_EVENT, () => {
  localStorage.removeItem("myapp:user");
  // 他のアプリ固有キーもここで削除
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

```typescript
// src/app/pages/LoginPage.tsx
import { useAuth } from "@koumatsumoto/gh-auth-bridge-client/react";

export function LoginPage() {
  const { state, login } = useAuth();

  if (state.isLoading) return <p>Loading...</p>;
  if (state.user) return <p>Logged in as {state.user.login}</p>;

  return <button onClick={login}>Login with GitHub</button>;
}
```

### Core のみ（フレームワーク非依存）の場合

```typescript
import {
  configure,
  openLoginPopup,
  setTokenSet,
  registerTokenRefresh,
  refreshAccessToken,
  getRefreshToken,
  getProxyUrl,
  githubFetch,
} from "@koumatsumoto/gh-auth-bridge-client";

configure({ proxyUrl: "https://gh-auth-bridge.example.workers.dev" });

// token refresh を手動で登録
registerTokenRefresh(async () => {
  const rt = getRefreshToken();
  if (!rt) throw new Error("No refresh token");
  const tokenSet = await refreshAccessToken(getProxyUrl(), rt);
  setTokenSet(tokenSet);
  return tokenSet.accessToken;
});

// login
const tokenSet = await openLoginPopup(getProxyUrl());
setTokenSet(tokenSet);

// GitHub API call
const response = await githubFetch("/user");
const user = await response.json();
```

## 4. 環境変数

- `VITE_OAUTH_PROXY_URL`
  — gh-auth-bridge Worker の URL
  — 開発: `http://localhost:8787`
  — 本番: `https://gh-auth-bridge.xxx.workers.dev`

`.env`:

```ini
VITE_OAUTH_PROXY_URL=http://localhost:8787
```

GitHub Actions Variables (本番):

```text
OAUTH_PROXY_URL=https://gh-auth-bridge.koumatsumoto.workers.dev
```

## 5. CI/CD での認証設定

### 方法 A: GITHUB_TOKEN + Manage Actions access（推奨）

1. gh-auth-bridge の Package settings を開く:
   - GitHub → gh-auth-bridge → Packages → @koumatsumoto/gh-auth-bridge-client
   - Package settings → Manage Actions access
   - "Add Repository" → 消費側リポジトリを追加 → Role: Read

2. 消費側の workflow:

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

### 方法 B: PAT を使用

1. `read:packages` スコープの PAT (classic) を作成
2. 消費側の Repository secrets に `GH_PACKAGES_TOKEN` として登録
3. workflow で使用:

```yaml
- run: pnpm install --frozen-lockfile
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GH_PACKAGES_TOKEN }}
```

## 6. トラブルシューティング

### `npm error 401 Unauthorized`

- `.npmrc` の `_authToken` が正しいか確認
- PAT に `read:packages` スコープがあるか確認
- GitHub Packages は **public パッケージでも認証が必要**

### `npm error 403 Forbidden`

- CI の場合: Package settings の "Manage Actions access" に消費側リポジトリを追加したか確認
- permissions に `packages: read` を追加したか確認

### `gh-auth-bridge-client is not configured`

- `configure({ proxyUrl })` がアプリ起動時に呼ばれているか確認
- React の場合、`setupTokenRefresh()` の前に `configure()` が実行されているか確認

### popup が開かない

- ブラウザのポップアップブロッカーを確認
- `proxyUrl` が正しいか確認（末尾に `/` をつけない）
