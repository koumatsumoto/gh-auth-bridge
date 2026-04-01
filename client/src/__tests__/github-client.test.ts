import { describe, it, expect, beforeEach, vi } from "vitest";
import { githubFetch, throwIfNotOk } from "../github-client.js";
import { TOKEN_KEY } from "../storage-keys.js";
import { AuthError, GitHubApiError, NetworkError, RateLimitError } from "../errors.js";
import { registerTokenRefresh, _resetTokenRefresh } from "../token-refresh.js";

beforeEach(() => {
  localStorage.clear();
  _resetTokenRefresh();
  vi.restoreAllMocks();
});

describe("githubFetch", () => {
  it("throws AuthError when no token", async () => {
    await expect(githubFetch("/user")).rejects.toThrow(AuthError);
  });

  it("makes request with Bearer token", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    const mockResponse = new Response(JSON.stringify({ login: "test" }), { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const response = await githubFetch("/user");
    expect(response.status).toBe(200);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall?.[0]).toBe("https://api.github.com/user");
    const headers = (fetchCall?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token");
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("throws NetworkError on fetch failure", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(githubFetch("/user")).rejects.toThrow(NetworkError);
  });

  it("throws AuthError on 401 without refresh fn", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    await expect(githubFetch("/user")).rejects.toThrow(AuthError);
  });

  it("retries with new token on 401 when refresh fn registered", async () => {
    localStorage.setItem(TOKEN_KEY, "old-token");
    registerTokenRefresh(() => Promise.resolve("new-token"));

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await githubFetch("/user");
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const retryHeaders = (fetchSpy.mock.calls[1]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(retryHeaders["Authorization"]).toBe("Bearer new-token");
  });

  it("throws RateLimitError on 429", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { "X-RateLimit-Reset": "1700000000" },
      }),
    );

    await expect(githubFetch("/user")).rejects.toThrow(RateLimitError);
  });

  it("throws RateLimitError on 403 with zero remaining", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 403,
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1700000000" },
      }),
    );

    await expect(githubFetch("/user")).rejects.toThrow(RateLimitError);
  });
});

describe("throwIfNotOk", () => {
  it("does nothing for ok response", async () => {
    await expect(throwIfNotOk(new Response(null, { status: 200 }))).resolves.toBeUndefined();
  });

  it("throws GitHubApiError for non-ok response", async () => {
    const response = new Response(JSON.stringify({ message: "not found" }), { status: 404 });
    await expect(throwIfNotOk(response)).rejects.toThrow(GitHubApiError);
  });

  it("handles invalid JSON body gracefully", async () => {
    const response = new Response("not json", { status: 500 });
    await expect(throwIfNotOk(response)).rejects.toThrow(GitHubApiError);
  });
});
