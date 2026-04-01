import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getToken,
  setToken,
  setTokenSet,
  getRefreshToken,
  clearToken,
  clearAccessToken,
  isAuthenticated,
  TOKEN_CLEARED_EVENT,
  TOKEN_REFRESHED_EVENT,
} from "../token-store.js";
import { TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY, REFRESH_EXPIRES_AT_KEY } from "../storage-keys.js";

beforeEach(() => {
  localStorage.clear();
});

describe("token-store", () => {
  describe("getToken / setToken", () => {
    it("returns null when no token stored", () => {
      expect(getToken()).toBeNull();
    });

    it("returns stored token", () => {
      setToken("test-token");
      expect(getToken()).toBe("test-token");
    });
  });

  describe("setTokenSet", () => {
    it("stores access token", () => {
      setTokenSet({ accessToken: "at", refreshToken: undefined, expiresAt: undefined, refreshExpiresAt: undefined });
      expect(localStorage.getItem(TOKEN_KEY)).toBe("at");
    });

    it("stores all fields when present", () => {
      setTokenSet({ accessToken: "at", refreshToken: "rt", expiresAt: 12345, refreshExpiresAt: 67890 });
      expect(localStorage.getItem(TOKEN_KEY)).toBe("at");
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("rt");
      expect(localStorage.getItem(EXPIRES_AT_KEY)).toBe("12345");
      expect(localStorage.getItem(REFRESH_EXPIRES_AT_KEY)).toBe("67890");
    });

    it("dispatches TOKEN_REFRESHED_EVENT", () => {
      const handler = vi.fn();
      window.addEventListener(TOKEN_REFRESHED_EVENT, handler);
      setTokenSet({ accessToken: "at", refreshToken: undefined, expiresAt: undefined, refreshExpiresAt: undefined });
      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener(TOKEN_REFRESHED_EVENT, handler);
    });
  });

  describe("getRefreshToken", () => {
    it("returns null when no refresh token", () => {
      expect(getRefreshToken()).toBeNull();
    });

    it("returns stored refresh token", () => {
      localStorage.setItem(REFRESH_TOKEN_KEY, "rt");
      expect(getRefreshToken()).toBe("rt");
    });
  });

  describe("clearToken", () => {
    it("removes all auth keys", () => {
      setTokenSet({ accessToken: "at", refreshToken: "rt", expiresAt: 100, refreshExpiresAt: 200 });
      clearToken();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRES_AT_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_EXPIRES_AT_KEY)).toBeNull();
    });

    it("dispatches TOKEN_CLEARED_EVENT when token existed", () => {
      setToken("at");
      const handler = vi.fn();
      window.addEventListener(TOKEN_CLEARED_EVENT, handler);
      clearToken();
      expect(handler).toHaveBeenCalledOnce();
      window.removeEventListener(TOKEN_CLEARED_EVENT, handler);
    });

    it("does not dispatch when no token existed", () => {
      const handler = vi.fn();
      window.addEventListener(TOKEN_CLEARED_EVENT, handler);
      clearToken();
      expect(handler).not.toHaveBeenCalled();
      window.removeEventListener(TOKEN_CLEARED_EVENT, handler);
    });
  });

  describe("clearAccessToken", () => {
    it("removes only access token and expiry", () => {
      setTokenSet({ accessToken: "at", refreshToken: "rt", expiresAt: 100, refreshExpiresAt: 200 });
      clearAccessToken();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(EXPIRES_AT_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("rt");
      expect(localStorage.getItem(REFRESH_EXPIRES_AT_KEY)).toBe("200");
    });
  });

  describe("isAuthenticated", () => {
    it("returns false when no token", () => {
      expect(isAuthenticated()).toBe(false);
    });

    it("returns true when token exists", () => {
      setToken("at");
      expect(isAuthenticated()).toBe(true);
    });
  });
});
