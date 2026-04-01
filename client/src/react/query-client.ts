import { QueryCache, QueryClient } from "@tanstack/react-query";
import { AuthError, GitHubApiError, TokenRefreshError } from "../errors.js";
import { clearToken, clearAccessToken } from "../token-store.js";
import { authLog } from "../auth-log.js";

export function createAuthQueryCache(): QueryCache {
  return new QueryCache({
    onError: (error, query) => {
      if (error instanceof TokenRefreshError) {
        if (error.reason === "transient") {
          authLog("global:auth-error", `query=${String(query.queryKey)} msg=${error.message} reason=transient`);
          clearAccessToken();
        } else {
          authLog("global:auth-error", `query=${String(query.queryKey)} msg=${error.message} reason=invalid_grant`);
          clearToken();
        }
        return;
      }
      if (error instanceof AuthError) {
        authLog("global:auth-error", `query=${String(query.queryKey)} msg=${error.message}`);
        clearToken();
      }
    },
  });
}

export function createAuthQueryClient(queryCache?: QueryCache): QueryClient {
  return new QueryClient({
    queryCache: queryCache ?? createAuthQueryCache(),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof AuthError) return false;
          if (error instanceof GitHubApiError && [403, 404, 422].includes(error.status)) {
            return false;
          }
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
      mutations: {
        retry: false,
      },
    },
  });
}
