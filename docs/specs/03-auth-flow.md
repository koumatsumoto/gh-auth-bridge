# 03. Auth Flow

## Popup Login

1. consumer app が popup で `/auth/login` を開く
2. Worker が `oauth_state` cookie を発行して GitHub OAuth へ redirect
3. GitHub が `/auth/callback` に `code` と `state` を返す
4. Worker が `state` を検証し token exchange を実行する
5. Worker が popup HTML から `window.opener.postMessage(...)` を実行する
6. consumer app が shared auth key に token を保存する

## GitHub App Install Authorization

1. GitHub App の `Install & Authorize` 導線で GitHub が `/auth/callback` を直接開く
2. callback に `state` が無い場合、Worker は OAuth code を交換せず standalone の案内ページを返す
3. `code` がある場合は completion page、無い場合は retry page を表示する
4. 利用者はそのタブを閉じて GitHub または consumer app 側へ戻る

## Refresh

1. consumer app が refresh token を送る
2. Worker が `Origin` を検証する
3. GitHub access token endpoint に `grant_type=refresh_token` で POST する
4. 新 token 群を JSON で返す
