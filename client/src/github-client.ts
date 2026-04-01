import { AuthError, GitHubApiError, NetworkError, RateLimitError } from "./errors.js";
import { extractRateLimit, isRateLimited } from "./rate-limit.js";
import { authLog } from "./auth-log.js";
import { getTokenRefreshFn } from "./token-refresh.js";
import { TOKEN_KEY } from "./storage-keys.js";

const GITHUB_API = "https://api.github.com";

function doFetch(path: string, token: string, options?: RequestInit): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

export async function githubFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    authLog("githubFetch:no-token", path);
    throw new AuthError("Not authenticated");
  }

  let response: Response;
  try {
    response = await doFetch(path, token, options);
  } catch (err) {
    authLog("githubFetch:network-error", path);
    throw new NetworkError("Unable to connect. Please check your internet connection.", { cause: err });
  }

  if (response.status === 401) {
    authLog("githubFetch:401", path);
    const refreshFn = getTokenRefreshFn();
    if (!refreshFn) {
      throw new AuthError("Token expired or revoked");
    }

    let newToken: string;
    try {
      newToken = await refreshFn();
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}:${err.message}` : String(err);
      authLog("githubFetch:refresh-failed", `${path} ${detail}`);
      if (err instanceof AuthError) throw err;
      throw new AuthError("Token expired or revoked");
    }

    try {
      response = await doFetch(path, newToken, options);
    } catch (err) {
      authLog("githubFetch:network-error-after-refresh", path);
      throw new NetworkError("Unable to connect. Please check your internet connection.", { cause: err });
    }

    if (response.status === 401) {
      authLog("githubFetch:retry-401", path);
      throw new AuthError("Token expired after refresh");
    }
  }

  if (isRateLimited(response)) {
    const { resetAt } = extractRateLimit(response.headers);
    authLog("githubFetch:rate-limit", path);
    throw new RateLimitError(resetAt);
  }

  return response;
}

export async function throwIfNotOk(response: Response): Promise<void> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    throw new GitHubApiError(response.status, body);
  }
}
