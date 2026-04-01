// Configuration
export { configure, getProxyUrl } from "./config.js";
export type { ClientConfig } from "./config.js";

// Types
export type { TokenSet, OAuthMessage, OAuthSuccessMessage, OAuthErrorMessage, AuthUser, AuthState, AuthContextValue, GitHubUser } from "./types.js";

// Errors
export { AuthError, TokenRefreshError, GitHubApiError, NetworkError, RateLimitError } from "./errors.js";
export type { TokenRefreshFailureReason } from "./errors.js";

// Auth client
export { openLoginPopup, refreshAccessToken, LOGIN_TIMEOUT_MS } from "./auth-client.js";

// Token store
export {
  getToken,
  setToken,
  setTokenSet,
  getRefreshToken,
  clearToken,
  clearAccessToken,
  isAuthenticated,
  TOKEN_CLEARED_EVENT,
  TOKEN_REFRESHED_EVENT,
} from "./token-store.js";

// Token refresh
export { registerTokenRefresh, getTokenRefreshFn, _resetTokenRefresh } from "./token-refresh.js";
export type { TokenRefreshFn } from "./token-refresh.js";

// GitHub client
export { githubFetch, throwIfNotOk } from "./github-client.js";

// Rate limit
export { extractRateLimit, isRateLimited } from "./rate-limit.js";
export type { RateLimitInfo } from "./rate-limit.js";

// Auth log
export { authLog, getAuthLog, clearAuthLog } from "./auth-log.js";

// Storage keys
export { TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY, REFRESH_EXPIRES_AT_KEY } from "./storage-keys.js";
