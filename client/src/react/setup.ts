import { registerTokenRefresh } from "../token-refresh.js";
import { getRefreshToken, setTokenSet } from "../token-store.js";
import { refreshAccessToken } from "../auth-client.js";
import { getProxyUrl } from "../config.js";
import { authLog } from "../auth-log.js";
import { AuthError, TokenRefreshError } from "../errors.js";

let refreshPromise: Promise<string> | null = null;

async function tryRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    authLog("token-refresh:missing-refresh-token");
    throw new AuthError("No refresh token available");
  }

  refreshPromise = (async () => {
    try {
      const proxyUrl = getProxyUrl();
      const tokenSet = await refreshAccessToken(proxyUrl, refreshToken);
      setTokenSet(tokenSet);
      authLog("token-refresh:success", tokenSet.refreshToken ? "with-refresh-token" : "access-only");
      return tokenSet.accessToken;
    } catch (err) {
      if (err instanceof TokenRefreshError) {
        authLog("token-refresh:failed", `reason=${err.reason} message=${err.message}`);
        throw err;
      }
      if (err instanceof AuthError) {
        authLog("token-refresh:failed", err.message);
        throw err;
      }
      authLog("token-refresh:failed", String(err));
      throw new TokenRefreshError("transient", "Token refresh failed", { cause: err });
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setupTokenRefresh(): void {
  registerTokenRefresh(tryRefresh);
}
