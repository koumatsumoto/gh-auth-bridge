# 02. Worker Contract

## Endpoints

| Method | Path             | Purpose                                          |
| ------ | ---------------- | ------------------------------------------------ |
| `GET`  | `/auth/login`    | OAuth 開始                                       |
| `GET`  | `/auth/callback` | popup token bridge または standalone install案内 |
| `POST` | `/auth/refresh`  | refresh token 交換                               |
| `GET`  | `/auth/health`   | health check                                     |

## Callback behavior

- `state` がある callback は popup login 完了として扱い、cookie と照合した後に token exchange を行う
- `state` がない callback は GitHub App install 導線の direct-tab callback
  として扱い、token exchange は行わず案内ページを返す

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

| Name                   | Kind     | Purpose                         |
| ---------------------- | -------- | ------------------------------- |
| `GITHUB_CLIENT_ID`     | Secret   | GitHub token exchange           |
| `GITHUB_CLIENT_SECRET` | Secret   | GitHub token exchange           |
| `SPA_ORIGIN`           | Variable | `Origin` / `postMessage` 許可先 |
