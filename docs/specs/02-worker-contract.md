# 02. Worker Contract

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/login` | OAuth 開始 |
| `GET` | `/auth/callback` | code 交換 + popup 応答 |
| `POST` | `/auth/refresh` | refresh token 交換 |
| `GET` | `/auth/health` | health check |

## postMessage payload

成功:

```json
{
  "type": "gh-auth-bridge:auth:success",
  "accessToken": "..."
}
```

失敗:

```json
{
  "type": "gh-auth-bridge:auth:error",
  "error": "missing_params"
}
```

## Refresh response

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 28800,
  "refreshTokenExpiresIn": 15811200
}
```

## Runtime bindings

| Name | Kind | Purpose |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | Secret | GitHub token exchange |
| `GITHUB_CLIENT_SECRET` | Secret | GitHub token exchange |
| `SPA_ORIGIN` | Variable | `Origin` / `postMessage` 許可先 |
