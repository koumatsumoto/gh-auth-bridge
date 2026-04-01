import { describe, it, expect } from "vitest";
import { AuthError, TokenRefreshError, GitHubApiError, NetworkError, RateLimitError } from "../errors.js";

describe("errors", () => {
  it("AuthError has correct name", () => {
    const err = new AuthError("test");
    expect(err.name).toBe("AuthError");
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("TokenRefreshError extends AuthError", () => {
    const err = new TokenRefreshError("invalid_grant", "test");
    expect(err.name).toBe("AuthError");
    expect(err.reason).toBe("invalid_grant");
    expect(err).toBeInstanceOf(AuthError);
  });

  it("TokenRefreshError accepts cause option", () => {
    const cause = new Error("cause");
    const err = new TokenRefreshError("transient", "test", { cause });
    expect(err.cause).toBe(cause);
  });

  it("GitHubApiError has status and body", () => {
    const err = new GitHubApiError(404, { message: "not found" });
    expect(err.name).toBe("GitHubApiError");
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ message: "not found" });
  });

  it("NetworkError has correct name", () => {
    const err = new NetworkError("offline");
    expect(err.name).toBe("NetworkError");
  });

  it("RateLimitError has resetAt", () => {
    const resetAt = new Date("2026-01-01T00:00:00Z");
    const err = new RateLimitError(resetAt);
    expect(err.name).toBe("RateLimitError");
    expect(err.resetAt).toBe(resetAt);
  });
});
