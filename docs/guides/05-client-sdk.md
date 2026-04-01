# 05. Client SDK

新規プロジェクトで `@koumatsumoto/gh-auth-bridge-client` を導入する手順。

## 前提条件

- gh-auth-bridge Worker がデプロイ済み
- GitHub App が設定済み（[01-github-app.md](./01-github-app.md) 参照）
- Node.js >= 24, pnpm >= 10

## 1. パッケージインストール

```bash
pnpm add @koumatsumoto/gh-auth-bridge-client
```

## 2. アプリへの組み込み

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

## 3. 環境変数

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

## 4. トラブルシューティング

### `gh-auth-bridge-client is not configured`

- `configure({ proxyUrl })` がアプリ起動時に呼ばれているか確認
- React の場合、`setupTokenRefresh()` の前に `configure()` が実行されているか確認

### popup が開かない

- ブラウザのポップアップブロッカーを確認
- `proxyUrl` が正しいか確認（末尾に `/` をつけない）
