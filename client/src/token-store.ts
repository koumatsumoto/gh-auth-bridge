import type { TokenSet } from "./types.js";
import { authLog } from "./auth-log.js";
import { TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY, REFRESH_EXPIRES_AT_KEY } from "./storage-keys.js";

export const TOKEN_CLEARED_EVENT = "gh-auth-bridge:token-cleared";
export const TOKEN_REFRESHED_EVENT = "gh-auth-bridge:token-refreshed";

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  authLog("getToken", token ? "found" : "missing");
  return token;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  authLog("setToken");
}

export function setTokenSet(tokenSet: TokenSet): void {
  setToken(tokenSet.accessToken);
  if (tokenSet.refreshToken !== undefined) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokenSet.refreshToken);
  }
  if (tokenSet.expiresAt !== undefined) {
    localStorage.setItem(EXPIRES_AT_KEY, String(tokenSet.expiresAt));
  }
  if (tokenSet.refreshExpiresAt !== undefined) {
    localStorage.setItem(REFRESH_EXPIRES_AT_KEY, String(tokenSet.refreshExpiresAt));
  }
  authLog("setTokenSet", tokenSet.refreshToken ? "with-refresh" : "access-only");
  window.dispatchEvent(new Event(TOKEN_REFRESHED_EVENT));
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearToken(): void {
  const hadToken = localStorage.getItem(TOKEN_KEY) !== null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_EXPIRES_AT_KEY);
  if (!hadToken) return;
  authLog("clearToken");
  window.dispatchEvent(new Event(TOKEN_CLEARED_EVENT));
}

export function clearAccessToken(): void {
  const hadToken = localStorage.getItem(TOKEN_KEY) !== null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  if (!hadToken) return;
  authLog("clearAccessToken");
  window.dispatchEvent(new Event(TOKEN_CLEARED_EVENT));
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
