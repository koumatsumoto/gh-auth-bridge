import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openLoginPopup, refreshAccessToken } from "../auth-client.js";
import { TokenRefreshError } from "../errors.js";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("openLoginPopup", () => {
  it("rejects when popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    await expect(openLoginPopup("https://proxy.test")).rejects.toThrow("Popup blocked");
  });

  it("resolves with token set on success message", async () => {
    const mockPopup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window);

    const promise = openLoginPopup("https://proxy.test");

    const event = new MessageEvent("message", {
      origin: "https://proxy.test",
      data: {
        type: "gh-auth-bridge:auth:success",
        accessToken: "at-123",
        refreshToken: "rt-456",
        expiresIn: 3600,
        refreshTokenExpiresIn: 86400,
      },
    });
    window.dispatchEvent(event);

    const result = await promise;
    expect(result.accessToken).toBe("at-123");
    expect(result.refreshToken).toBe("rt-456");
    expect(result.expiresAt).toBeTypeOf("number");
    expect(mockPopup.close).toHaveBeenCalled();
  });

  it("rejects on error message", async () => {
    const mockPopup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window);

    const promise = openLoginPopup("https://proxy.test");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://proxy.test",
        data: { type: "gh-auth-bridge:auth:error", error: "access_denied" },
      }),
    );

    await expect(promise).rejects.toThrow("access_denied");
    expect(mockPopup.close).toHaveBeenCalled();
  });

  it("ignores messages from wrong origin", async () => {
    const mockPopup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window);

    const promise = openLoginPopup("https://proxy.test");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://evil.test",
        data: { type: "gh-auth-bridge:auth:success", accessToken: "stolen" },
      }),
    );

    // Send correct message to resolve
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://proxy.test",
        data: { type: "gh-auth-bridge:auth:success", accessToken: "real" },
      }),
    );

    const result = await promise;
    expect(result.accessToken).toBe("real");
  });

  it("rejects when popup is closed by user", async () => {
    const mockPopup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window);

    const promise = openLoginPopup("https://proxy.test");

    mockPopup.closed = true;
    vi.advanceTimersByTime(600);

    await expect(promise).rejects.toThrow("closed before authentication");
  });

  it("rejects on timeout", async () => {
    const mockPopup = { close: vi.fn(), closed: false };
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window);

    const promise = openLoginPopup("https://proxy.test");

    vi.advanceTimersByTime(120_000);

    await expect(promise).rejects.toThrow("timed out");
    expect(mockPopup.close).toHaveBeenCalled();
  });
});

describe("refreshAccessToken", () => {
  it("returns token set on success", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "new-at",
          refreshToken: "new-rt",
          expiresIn: 28800,
          refreshTokenExpiresIn: 15811200,
        }),
        { status: 200 },
      ),
    );

    const result = await refreshAccessToken("https://proxy.test", "old-rt");
    expect(result.accessToken).toBe("new-at");
    expect(result.refreshToken).toBe("new-rt");
    expect(result.expiresAt).toBeTypeOf("number");
    expect(result.refreshExpiresAt).toBeTypeOf("number");
  });

  it("sends correct request", async () => {
    vi.useRealTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ accessToken: "at" }), { status: 200 }));

    await refreshAccessToken("https://proxy.test", "rt-123");

    expect(fetchSpy).toHaveBeenCalledWith("https://proxy.test/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "rt-123" }),
    });
  });

  it("throws transient on network error", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await refreshAccessToken("https://proxy.test", "rt");
    } catch (err) {
      expect(err).toBeInstanceOf(TokenRefreshError);
      expect((err as TokenRefreshError).reason).toBe("transient");
    }
  });

  it("throws invalid_grant on 401", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    try {
      await refreshAccessToken("https://proxy.test", "rt");
    } catch (err) {
      expect(err).toBeInstanceOf(TokenRefreshError);
      expect((err as TokenRefreshError).reason).toBe("invalid_grant");
    }
  });

  it("throws transient on 500", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Server Error", { status: 500 }));

    try {
      await refreshAccessToken("https://proxy.test", "rt");
    } catch (err) {
      expect(err).toBeInstanceOf(TokenRefreshError);
      expect((err as TokenRefreshError).reason).toBe("transient");
    }
  });

  it("throws transient on missing accessToken", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    await expect(refreshAccessToken("https://proxy.test", "rt")).rejects.toThrow(TokenRefreshError);
  });

  it("reads JSON error body", async () => {
    vi.useRealTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await refreshAccessToken("https://proxy.test", "rt");
    } catch (err) {
      expect(err).toBeInstanceOf(TokenRefreshError);
      expect((err as TokenRefreshError).message).toContain("bad_token");
    }
  });
});
