import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker from "../index";

const TEST_ENV = {
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
  SPA_ORIGIN: "http://localhost:5173",
};

const FIXED_STATE = "fixed-uuid-state";

function createRequest(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost:8787${path}`, options);
}

function createCallbackRequest(params: { code?: string; state?: string }, cookieState?: string): Request {
  const searchParams = new URLSearchParams();
  if (params.code) searchParams.set("code", params.code);
  if (params.state) searchParams.set("state", params.state);

  const headers: HeadersInit = {};
  if (cookieState) {
    headers["Cookie"] = `oauth_state=${cookieState}`;
  }

  return new Request(`http://localhost:8787/auth/callback?${searchParams.toString()}`, { headers });
}

function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
}

describe("OAuth Proxy Worker", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_STATE as ReturnType<typeof crypto.randomUUID>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /auth/health", () => {
    it("returns 200 OK", async () => {
      const response = await worker.fetch(createRequest("/auth/health"), TEST_ENV);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("OK");
    });

    it("includes security headers", async () => {
      const response = await worker.fetch(createRequest("/auth/health"), TEST_ENV);

      expectSecurityHeaders(response);
    });
  });

  describe("OPTIONS (CORS preflight)", () => {
    it("returns 204 with CORS headers", async () => {
      const response = await worker.fetch(createRequest("/auth/login", { method: "OPTIONS" }), TEST_ENV);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(TEST_ENV.SPA_ORIGIN);
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
      expect(response.headers.get("Access-Control-Max-Age")).toBe("3600");
    });

    it("includes security headers", async () => {
      const response = await worker.fetch(createRequest("/auth/login", { method: "OPTIONS" }), TEST_ENV);

      expectSecurityHeaders(response);
    });
  });

  describe("GET /auth/login", () => {
    it("returns 302 redirect to GitHub OAuth", async () => {
      const response = await worker.fetch(createRequest("/auth/login"), TEST_ENV);

      expect(response.status).toBe(302);

      const locationHeader = response.headers.get("Location");
      if (!locationHeader) throw new Error("Location header missing");
      const location = new URL(locationHeader);
      expect(location.origin).toBe("https://github.com");
      expect(location.pathname).toBe("/login/oauth/authorize");
      expect(location.searchParams.get("client_id")).toBe(TEST_ENV.GITHUB_CLIENT_ID);
      expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:8787/auth/callback");
      expect(location.searchParams.has("scope")).toBe(false);
      expect(location.searchParams.get("state")).toBe(FIXED_STATE);
    });

    it("sets HttpOnly cookie with state", async () => {
      const response = await worker.fetch(createRequest("/auth/login"), TEST_ENV);

      const cookie = response.headers.get("Set-Cookie");
      expect(cookie).toContain(`oauth_state=${FIXED_STATE}`);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Max-Age=600");
      expect(cookie).toContain("Path=/");
    });

    it("includes security headers", async () => {
      const response = await worker.fetch(createRequest("/auth/login"), TEST_ENV);

      expectSecurityHeaders(response);
    });

    it("rejects non-GET methods", async () => {
      const response = await worker.fetch(createRequest("/auth/login", { method: "POST" }), TEST_ENV);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /auth/callback", () => {
    describe("validation errors", () => {
      it("returns error when code is missing", async () => {
        const response = await worker.fetch(createCallbackRequest({ state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        expect(response.headers.get("Content-Type")).toBe("text/html");
        const body = await response.text();
        expect(body).toContain('"type":"gh-auth-bridge:auth:error"');
        expect(body).toContain('"error":"missing_params"');
        expect(body).toContain(`"${TEST_ENV.SPA_ORIGIN}"`);
        expect(body).toContain("window.close()");
      });

      it("returns error when state is missing", async () => {
        const response = await worker.fetch(createCallbackRequest({ code: "test-code" }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"error":"missing_params"');
      });

      it("returns error when state does not match cookie", async () => {
        const response = await worker.fetch(createCallbackRequest({ code: "test-code", state: "wrong-state" }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"error":"invalid_state"');
      });

      it("returns error when cookie is missing", async () => {
        const response = await worker.fetch(createCallbackRequest({ code: "test-code", state: FIXED_STATE }), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"error":"invalid_state"');
      });
    });

    describe("token exchange", () => {
      it("returns success with access token on successful exchange", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "gho_test_token_123" }), {
            headers: { "Content-Type": "application/json" },
          }),
        );

        const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"type":"gh-auth-bridge:auth:success"');
        expect(body).toContain('"accessToken":"gho_test_token_123"');
        expect(body).toContain(`"${TEST_ENV.SPA_ORIGIN}"`);
        expect(body).toContain("window.close()");

        expect(fetchSpy).toHaveBeenCalledWith("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: TEST_ENV.GITHUB_CLIENT_ID,
            client_secret: TEST_ENV.GITHUB_CLIENT_SECRET,
            code: "valid-code",
          }),
        });
      });

      it("forwards refresh token data when present in GitHub response", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              access_token: "gho_access",
              refresh_token: "ghr_refresh",
              expires_in: 28800,
              refresh_token_expires_in: 15811200,
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );

        const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"accessToken":"gho_access"');
        expect(body).toContain('"refreshToken":"ghr_refresh"');
        expect(body).toContain('"expiresIn":28800');
        expect(body).toContain('"refreshTokenExpiresIn":15811200');
      });

      it("omits refresh fields when GitHub response has no refresh_token", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "gho_no_refresh" }), {
            headers: { "Content-Type": "application/json" },
          }),
        );

        const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"accessToken":"gho_no_refresh"');
        expect(body).not.toContain("refreshToken");
      });

      it("returns error when GitHub API returns no access_token", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "bad_verification_code" }), {
            headers: { "Content-Type": "application/json" },
          }),
        );

        const response = await worker.fetch(createCallbackRequest({ code: "invalid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"error":"token_exchange_failed"');
      });

      it("returns error when GitHub API fetch throws", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

        const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const body = await response.text();
        expect(body).toContain('"error":"token_exchange_failed"');
      });
    });

    describe("cookie clearing", () => {
      it("clears cookie on successful callback", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: "gho_test" }), {
            headers: { "Content-Type": "application/json" },
          }),
        );

        const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const cookie = response.headers.get("Set-Cookie");
        expect(cookie).toContain("oauth_state=");
        expect(cookie).toContain("Max-Age=0");
      });

      it("clears cookie on error callback", async () => {
        const response = await worker.fetch(createCallbackRequest({ state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

        const cookie = response.headers.get("Set-Cookie");
        expect(cookie).toContain("oauth_state=");
        expect(cookie).toContain("Max-Age=0");
      });
    });

    it("includes security headers", async () => {
      const response = await worker.fetch(createCallbackRequest({ state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

      expectSecurityHeaders(response);
    });

    it("includes CSP header", async () => {
      const response = await worker.fetch(createCallbackRequest({ state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

      expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; script-src 'unsafe-inline'");
    });

    it("rejects non-GET methods", async () => {
      const response = await worker.fetch(new Request("http://localhost:8787/auth/callback?code=test&state=test", { method: "POST" }), TEST_ENV);

      expect(response.status).toBe(404);
    });

    it("escapes special characters in SPA_ORIGIN for postMessage", async () => {
      const maliciousEnv = {
        ...TEST_ENV,
        SPA_ORIGIN: 'https://evil.com");alert(1)//',
      };

      const response = await worker.fetch(createCallbackRequest({ state: FIXED_STATE }, FIXED_STATE), maliciousEnv);

      const body = await response.text();
      expect(body).toContain('evil.com\\");alert(1)');
      expect(body).not.toMatch(/[^\\]"\);alert/);
    });

    it("escapes script-breaking characters in HTML output", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token</script><script>alert(1)" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      const response = await worker.fetch(createCallbackRequest({ code: "valid-code", state: FIXED_STATE }, FIXED_STATE), TEST_ENV);

      const body = await response.text();
      expect(body).not.toContain("</script><script>");
      expect(body).toContain("\\u003c");
    });
  });

  describe("POST /auth/refresh", () => {
    function createRefreshRequest(body: object, origin?: string): Request {
      return new Request("http://localhost:8787/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin ?? TEST_ENV.SPA_ORIGIN,
        },
        body: JSON.stringify(body),
      });
    }

    it("returns new tokens on successful refresh", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "gho_new_access",
            refresh_token: "ghr_new_refresh",
            expires_in: 28800,
            refresh_token_expires_in: 15811200,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );

      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_old_refresh" }), TEST_ENV);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        accessToken: "gho_new_access",
        refreshToken: "ghr_new_refresh",
        expiresIn: 28800,
        refreshTokenExpiresIn: 15811200,
      });
    });

    it("sends correct payload to GitHub", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "gho_new" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      await worker.fetch(createRefreshRequest({ refreshToken: "ghr_test" }), TEST_ENV);

      expect(fetchSpy).toHaveBeenCalledWith("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: TEST_ENV.GITHUB_CLIENT_ID,
          client_secret: TEST_ENV.GITHUB_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: "ghr_test",
        }),
      });
    });

    it("returns 403 when Origin does not match SPA_ORIGIN", async () => {
      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_test" }, "https://evil.com"), TEST_ENV);

      expect(response.status).toBe(403);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("forbidden_origin");
    });

    it("accepts Origin when SPA_ORIGIN includes path and trailing slash", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "gho_new" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      const envWithPath = { ...TEST_ENV, SPA_ORIGIN: "https://koumatsumoto.github.io/ato/" };

      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_test" }, "https://koumatsumoto.github.io"), envWithPath);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://koumatsumoto.github.io");
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await worker.fetch(
        new Request("http://localhost:8787/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: TEST_ENV.SPA_ORIGIN },
          body: "not-json",
        }),
        TEST_ENV,
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("invalid_request");
    });

    it("returns 400 when refreshToken is missing", async () => {
      const response = await worker.fetch(createRefreshRequest({}), TEST_ENV);

      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("missing_refresh_token");
    });

    it("returns 401 when GitHub returns no access_token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "bad_refresh_token" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_expired" }), TEST_ENV);

      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("refresh_failed");
    });

    it("returns 502 when GitHub API fetch throws", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_test" }), TEST_ENV);

      expect(response.status).toBe(502);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("refresh_failed");
    });

    it("includes CORS and security headers", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "gho_new" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      const response = await worker.fetch(createRefreshRequest({ refreshToken: "ghr_test" }), TEST_ENV);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(TEST_ENV.SPA_ORIGIN);
      expectSecurityHeaders(response);
    });
  });

  describe("404 fallback", () => {
    it("returns 404 for unknown paths", async () => {
      const response = await worker.fetch(createRequest("/unknown"), TEST_ENV);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    });

    it("includes security headers", async () => {
      const response = await worker.fetch(createRequest("/unknown"), TEST_ENV);

      expectSecurityHeaders(response);
    });
  });
});
