import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthContextValue, AuthState, AuthUser, GitHubUser } from "../types.js";
import { AuthError, GitHubApiError, NetworkError, RateLimitError } from "../errors.js";
import { getToken, setTokenSet, clearToken, TOKEN_CLEARED_EVENT, TOKEN_REFRESHED_EVENT } from "../token-store.js";
import { openLoginPopup } from "../auth-client.js";
import { githubFetch } from "../github-client.js";
import { getProxyUrl } from "../config.js";
import { authLog } from "../auth-log.js";

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<AuthUser> => {
      authLog("auth-query:start");
      const response = await githubFetch("/user");
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        authLog("auth-query:api-error", `status=${String(response.status)}`);
        throw new GitHubApiError(response.status, body);
      }
      const data = (await response.json()) as unknown as GitHubUser;
      authLog("auth-query:success", data.login);
      return {
        login: data.login,
        id: data.id,
        avatarUrl: data.avatar_url,
      };
    },
    enabled: !!token,
    retry: (failureCount, err) => {
      if (err instanceof AuthError) return false;
      if (err instanceof NetworkError) return failureCount < 3;
      if (err instanceof RateLimitError) return failureCount < 2;
      if (err instanceof GitHubApiError && err.status >= 500) return failureCount < 3;
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const onTokenCleared = () => {
      authLog("token-cleared:event");
      setTokenState(null);
      queryClient.clear();
    };
    window.addEventListener(TOKEN_CLEARED_EVENT, onTokenCleared);
    return () => {
      window.removeEventListener(TOKEN_CLEARED_EVENT, onTokenCleared);
    };
  }, [queryClient]);

  useEffect(() => {
    const onTokenRefreshed = () => {
      const newToken = getToken();
      authLog("token-refreshed:event", newToken ? "found" : "missing");
      setTokenState(newToken);
    };
    window.addEventListener(TOKEN_REFRESHED_EVENT, onTokenRefreshed);
    return () => {
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onTokenRefreshed);
    };
  }, []);

  const login = useCallback(async () => {
    const proxyUrl = getProxyUrl();
    const tokenSet = await openLoginPopup(proxyUrl);
    setTokenSet(tokenSet);
    setTokenState(tokenSet.accessToken);
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  const state: AuthState = useMemo(
    () => ({
      token,
      user: user ?? null,
      isLoading: !!token && isLoading,
    }),
    [token, user, isLoading],
  );

  const value: AuthContextValue = useMemo(() => ({ state, login, logout }), [state, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
